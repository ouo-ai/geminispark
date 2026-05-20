import {
  BillingPlan,
  CreditBucket,
  CreditTransactionType,
  Prisma,
  SubscriptionStatus,
  TaskIntent,
} from "@prisma/client"

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

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function planCredits(plan: BillingPlan) {
  if (plan === BillingPlan.STARTUP) return 100
  if (plan === BillingPlan.PRO) return 250
  return 0
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function creditCostForIntent(intent: TaskIntent) {
  if (intent === TaskIntent.IMAGE) return 5
  if (intent === TaskIntent.TEXT_TO_VIDEO || intent === TaskIntent.IMAGE_TO_VIDEO) return 10
  return 1
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

  const monthlyCredits = planCredits(credit.plan)
  if (!ACTIVE_STATUSES.has(credit.subscriptionStatus) || monthlyCredits <= 0) {
    return credit
  }

  if (credit.nextCreditGrantAt && credit.nextCreditGrantAt > now) {
    return credit
  }

  const periodStart = now
  const periodEnd = addMonths(now, 1)
  credit = await tx.userCredit.update({
    where: { userId },
    data: {
      periodCreditsRemaining: monthlyCredits,
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
        amount: monthlyCredits,
        balanceAfterFree: credit.freeCreditsRemaining,
        balanceAfterPeriod: credit.periodCreditsRemaining,
        description: "Monthly plan credits granted.",
        idempotencyKey: `credit-period:${userId}:${periodStart.toISOString()}`,
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
