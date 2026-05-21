import type { BillingInterval, Prisma } from "@prisma/client"
import { BillingPlan, CreditBucket, CreditTransactionType, SubscriptionStatus, TaskIntent } from "@prisma/client"

import { prisma } from "./db.js"

export class PaymentRequiredError extends Error {
  constructor(
    message: string,
    readonly details: { requiredCredits: number; availableCredits: number },
  ) {
    super(message)
    this.name = "PaymentRequiredError"
  }
}

const INITIAL_FREE_CREDITS = 2
const ACTIVE_STATUSES = new Set<SubscriptionStatus>([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
const BILLING_INTERVAL = {
  MONTH: "MONTH",
  YEAR: "YEAR",
} as const satisfies { MONTH: BillingInterval; YEAR: BillingInterval }
const MANUAL_MEMBER_EMAILS = new Set(["danke030210@gmail.com"])
const MANUAL_MEMBER_PLAN = BillingPlan.PRO
const MANUAL_MEMBER_INTERVAL = BILLING_INTERVAL.MONTH

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function cycleMonths(interval: BillingInterval | null | undefined) {
  return interval === BILLING_INTERVAL.YEAR ? 12 : 1
}

function planCredits(plan: BillingPlan, interval?: BillingInterval | null) {
  const multiplier = cycleMonths(interval)
  if (plan === BillingPlan.STARTUP) return 1000 * multiplier
  if (plan === BillingPlan.PRO) return 2500 * multiplier
  return 0
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

async function manualMemberEmailForUser(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  const email = normalizeEmail(user?.email)

  return email && MANUAL_MEMBER_EMAILS.has(email) ? email : null
}

export function creditCostForIntent(intent: TaskIntent) {
  if (intent === TaskIntent.IMAGE) return 5
  if (intent === TaskIntent.TEXT_TO_VIDEO || intent === TaskIntent.IMAGE_TO_VIDEO) return 10
  return 1
}

async function syncManualMemberCreditTx(
  tx: Prisma.TransactionClient,
  credit: Prisma.UserCreditGetPayload<Record<string, never>>,
  email: string,
  now = new Date(),
) {
  const cycleCredits = planCredits(MANUAL_MEMBER_PLAN, MANUAL_MEMBER_INTERVAL)
  const shouldGrant =
    credit.plan !== MANUAL_MEMBER_PLAN ||
    credit.billingInterval !== MANUAL_MEMBER_INTERVAL ||
    !ACTIVE_STATUSES.has(credit.subscriptionStatus) ||
    !credit.nextCreditGrantAt ||
    credit.nextCreditGrantAt <= now
  const periodStart = now
  const periodEnd = addMonths(now, cycleMonths(MANUAL_MEMBER_INTERVAL))

  credit = await tx.userCredit.update({
    where: { userId: credit.userId },
    data: {
      plan: MANUAL_MEMBER_PLAN,
      billingInterval: MANUAL_MEMBER_INTERVAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      periodCreditsRemaining: shouldGrant ? cycleCredits : undefined,
      creditsPeriodStart: shouldGrant ? periodStart : undefined,
      creditsPeriodEnd: shouldGrant ? periodEnd : undefined,
      nextCreditGrantAt: shouldGrant ? periodEnd : undefined,
    },
  })

  if (shouldGrant) {
    await tx.creditTransaction.createMany({
      data: [
        {
          userId: credit.userId,
          type: CreditTransactionType.GRANT,
          bucket: CreditBucket.PERIOD,
          amount: cycleCredits,
          balanceAfterFree: credit.freeCreditsRemaining,
          balanceAfterPeriod: credit.periodCreditsRemaining,
          description: "Manual member plan credits granted.",
          idempotencyKey: `manual-member:${credit.userId}:${MANUAL_MEMBER_INTERVAL.toLowerCase()}:${periodStart.toISOString()}`,
          metadata: toJson({
            email,
            plan: MANUAL_MEMBER_PLAN,
            interval: MANUAL_MEMBER_INTERVAL,
            credits: cycleCredits,
            source: "manual_member",
          }),
        },
      ],
      skipDuplicates: true,
    })
  }

  return credit
}

async function syncCreditPeriodTx(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  let credit = await tx.userCredit.findUnique({ where: { userId } })
  if (!credit) {
    credit = await tx.userCredit.create({
      data: {
        userId,
        freeCreditsRemaining: INITIAL_FREE_CREDITS,
      },
    })

    await tx.creditTransaction.createMany({
      data: [
        {
          userId,
          type: CreditTransactionType.GRANT,
          bucket: CreditBucket.FREE,
          amount: INITIAL_FREE_CREDITS,
          balanceAfterFree: credit.freeCreditsRemaining,
          balanceAfterPeriod: credit.periodCreditsRemaining,
          description: "Initial free credits granted.",
          idempotencyKey: `initial-free:${userId}`,
        },
      ],
      skipDuplicates: true,
    })
  }

  const manualMemberEmail = await manualMemberEmailForUser(tx, userId)
  if (manualMemberEmail) {
    return syncManualMemberCreditTx(tx, credit, manualMemberEmail, now)
  }

  const interval = credit.billingInterval || BILLING_INTERVAL.MONTH
  const cycleCredits = planCredits(credit.plan, interval)
  if (!ACTIVE_STATUSES.has(credit.subscriptionStatus) || cycleCredits <= 0) {
    return credit
  }

  if (credit.nextCreditGrantAt && credit.nextCreditGrantAt > now) {
    return credit
  }

  const periodStart = now
  const periodEnd = addMonths(now, cycleMonths(interval))
  credit = await tx.userCredit.update({
    where: { userId },
    data: {
      periodCreditsRemaining: cycleCredits,
      creditsPeriodStart: periodStart,
      creditsPeriodEnd: periodEnd,
      nextCreditGrantAt: periodEnd,
    },
  })

  await tx.creditTransaction.createMany({
    data: [
      {
        userId,
        type: CreditTransactionType.GRANT,
        bucket: CreditBucket.PERIOD,
        amount: cycleCredits,
        balanceAfterFree: credit.freeCreditsRemaining,
        balanceAfterPeriod: credit.periodCreditsRemaining,
        description: interval === BILLING_INTERVAL.YEAR ? "Annual plan credits granted." : "Monthly plan credits granted.",
        idempotencyKey: `credit-period:${userId}:${interval.toLowerCase()}:${periodStart.toISOString()}`,
      },
    ],
    skipDuplicates: true,
  })

  return credit
}

export async function debitTaskCreditsTx(
  tx: Prisma.TransactionClient,
  params: {
    userId: string
    taskId: string
    cost: number
    intent: TaskIntent
  },
) {
  const credit = await syncCreditPeriodTx(tx, params.userId)
  const availableCredits = credit.freeCreditsRemaining + credit.periodCreditsRemaining

  if (availableCredits < params.cost) {
    throw new PaymentRequiredError("Not enough credits to run this task.", {
      requiredCredits: params.cost,
      availableCredits,
    })
  }

  const periodDebit = Math.min(credit.periodCreditsRemaining, params.cost)
  const freeDebit = params.cost - periodDebit
  const nextFree = credit.freeCreditsRemaining - freeDebit
  const nextPeriod = credit.periodCreditsRemaining - periodDebit

  const updated = await tx.userCredit.update({
    where: { userId: params.userId },
    data: {
      freeCreditsRemaining: nextFree,
      periodCreditsRemaining: nextPeriod,
    },
  })

  const rows: Prisma.CreditTransactionCreateManyInput[] = []
  if (periodDebit > 0) {
    rows.push({
      userId: params.userId,
      taskId: params.taskId,
      type: CreditTransactionType.DEBIT,
      bucket: CreditBucket.PERIOD,
      amount: -periodDebit,
      balanceAfterFree: updated.freeCreditsRemaining,
      balanceAfterPeriod: updated.periodCreditsRemaining,
      description: "Task credits debited.",
      idempotencyKey: `task:${params.taskId}:debit:period`,
      metadata: toJson({ intent: params.intent, cost: params.cost }),
    })
  }

  if (freeDebit > 0) {
    rows.push({
      userId: params.userId,
      taskId: params.taskId,
      type: CreditTransactionType.DEBIT,
      bucket: CreditBucket.FREE,
      amount: -freeDebit,
      balanceAfterFree: updated.freeCreditsRemaining,
      balanceAfterPeriod: updated.periodCreditsRemaining,
      description: "Task credits debited.",
      idempotencyKey: `task:${params.taskId}:debit:free`,
      metadata: toJson({ intent: params.intent, cost: params.cost }),
    })
  }

  if (rows.length > 0) {
    await tx.creditTransaction.createMany({ data: rows, skipDuplicates: true })
  }

  return periodDebit > 0 ? CreditBucket.PERIOD : CreditBucket.FREE
}

export async function refundTaskCredits(taskId: string, description = "Task credits refunded.") {
  await prisma.$transaction(async (tx) => {
    const debits = await tx.creditTransaction.findMany({
      where: {
        taskId,
        type: CreditTransactionType.DEBIT,
        amount: { lt: 0 },
      },
    })

    if (debits.length === 0) {
      return
    }

    const alreadyRefunded = await tx.creditTransaction.findFirst({
      where: {
        taskId,
        type: CreditTransactionType.REFUND,
      },
    })
    if (alreadyRefunded) {
      return
    }

    const userId = debits[0].userId
    const freeRefund = debits
      .filter((transaction) => transaction.bucket === CreditBucket.FREE)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    const periodRefund = debits
      .filter((transaction) => transaction.bucket === CreditBucket.PERIOD)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)

    const updated = await tx.userCredit.update({
      where: { userId },
      data: {
        freeCreditsRemaining: { increment: freeRefund },
        periodCreditsRemaining: { increment: periodRefund },
      },
    })

    const rows: Prisma.CreditTransactionCreateManyInput[] = []
    if (freeRefund > 0) {
      rows.push({
        userId,
        taskId,
        type: CreditTransactionType.REFUND,
        bucket: CreditBucket.FREE,
        amount: freeRefund,
        balanceAfterFree: updated.freeCreditsRemaining,
        balanceAfterPeriod: updated.periodCreditsRemaining,
        description,
        idempotencyKey: `task:${taskId}:refund:free`,
      })
    }

    if (periodRefund > 0) {
      rows.push({
        userId,
        taskId,
        type: CreditTransactionType.REFUND,
        bucket: CreditBucket.PERIOD,
        amount: periodRefund,
        balanceAfterFree: updated.freeCreditsRemaining,
        balanceAfterPeriod: updated.periodCreditsRemaining,
        description,
        idempotencyKey: `task:${taskId}:refund:period`,
      })
    }

    if (rows.length > 0) {
      await tx.creditTransaction.createMany({ data: rows, skipDuplicates: true })
    }
  })
}
