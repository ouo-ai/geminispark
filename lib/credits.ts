import {
  BillingPlan,
  CreditBucket,
  CreditTransactionType,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client"

import { addMonths, BILLING_PLANS, INITIAL_FREE_CREDITS, type PaidPlan } from "@/lib/billing-config"
import { prisma } from "@/lib/db"

const ACTIVE_STATUSES = new Set<SubscriptionStatus>([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])

type CreditRecord = Prisma.UserCreditGetPayload<Record<string, never>>

function planCredits(plan: BillingPlan) {
  if (plan === BillingPlan.STARTUP) return BILLING_PLANS.STARTUP.monthlyCredits
  if (plan === BillingPlan.PRO) return BILLING_PLANS.PRO.monthlyCredits
  return 0
}

function toBillingPlan(plan: PaidPlan) {
  return plan === "STARTUP" ? BillingPlan.STARTUP : BillingPlan.PRO
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function serializeCredit(credit: CreditRecord) {
  return {
    freeCreditsRemaining: credit.freeCreditsRemaining,
    periodCreditsRemaining: credit.periodCreditsRemaining,
    totalCredits: credit.freeCreditsRemaining + credit.periodCreditsRemaining,
    plan: credit.plan.toLowerCase(),
    subscriptionStatus: credit.subscriptionStatus.toLowerCase(),
    creditsPeriodStart: credit.creditsPeriodStart?.toISOString() || null,
    creditsPeriodEnd: credit.creditsPeriodEnd?.toISOString() || null,
    nextCreditGrantAt: credit.nextCreditGrantAt?.toISOString() || null,
  }
}

function nextMonthlyGrantDates(now = new Date()) {
  const periodEnd = addMonths(now, 1)
  return {
    creditsPeriodStart: now,
    creditsPeriodEnd: periodEnd,
    nextCreditGrantAt: periodEnd,
  }
}

async function syncCreditPeriod(tx: Prisma.TransactionClient, credit: CreditRecord, now = new Date()) {
  const monthlyCredits = planCredits(credit.plan)
  if (!ACTIVE_STATUSES.has(credit.subscriptionStatus) || monthlyCredits <= 0) {
    return credit
  }

  if (credit.nextCreditGrantAt && credit.nextCreditGrantAt > now) {
    return credit
  }

  const dates = nextMonthlyGrantDates(now)
  const updated = await tx.userCredit.update({
    where: { userId: credit.userId },
    data: {
      periodCreditsRemaining: monthlyCredits,
      ...dates,
    },
  })

  await tx.creditTransaction.createMany({
    data: [
      {
        userId: credit.userId,
        type: CreditTransactionType.GRANT,
        bucket: CreditBucket.PERIOD,
        amount: monthlyCredits,
        balanceAfterFree: updated.freeCreditsRemaining,
        balanceAfterPeriod: updated.periodCreditsRemaining,
        description: "Monthly plan credits granted.",
        idempotencyKey: `credit-period:${credit.userId}:${dates.creditsPeriodStart.toISOString()}`,
      },
    ],
    skipDuplicates: true,
  })

  return updated
}

export async function ensureUserCredit(userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.userCredit.findUnique({ where: { userId } })
    if (existing) {
      const synced = await syncCreditPeriod(tx, existing)
      return serializeCredit(synced)
    }

    const created = await tx.userCredit.create({
      data: {
        userId,
        freeCreditsRemaining: INITIAL_FREE_CREDITS,
      },
    })

    await tx.creditTransaction.create({
      data: {
        userId,
        type: CreditTransactionType.GRANT,
        bucket: CreditBucket.FREE,
        amount: INITIAL_FREE_CREDITS,
        balanceAfterFree: created.freeCreditsRemaining,
        balanceAfterPeriod: created.periodCreditsRemaining,
        description: "Initial free credits granted.",
        idempotencyKey: `initial-free:${userId}`,
      },
    })

    return serializeCredit(created)
  })
}

export async function getWorkspaceStatus(userId: string) {
  const workspace = await prisma.userWorkspace.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "openclaw",
      },
    },
  })

  return {
    provider: "openclaw",
    status: workspace?.status.toLowerCase() || "missing",
    workspaceId: workspace?.workspaceId || null,
    initializedAt: workspace?.initializedAt?.toISOString() || null,
    lastUsedAt: workspace?.lastUsedAt?.toISOString() || null,
    error: workspace?.error || null,
  }
}

export async function ensureStripeCustomer(userId: string, createCustomer: () => Promise<string>) {
  const credit = await prisma.userCredit.findUnique({ where: { userId } })
  if (credit?.stripeCustomerId) {
    return credit.stripeCustomerId
  }

  const customerId = await createCustomer()
  await prisma.userCredit.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      freeCreditsRemaining: INITIAL_FREE_CREDITS,
    },
    update: {
      stripeCustomerId: customerId,
    },
  })

  await prisma.creditTransaction.createMany({
    data: [
      {
        userId,
        type: CreditTransactionType.GRANT,
        bucket: CreditBucket.FREE,
        amount: INITIAL_FREE_CREDITS,
        balanceAfterFree: INITIAL_FREE_CREDITS,
        balanceAfterPeriod: 0,
        description: "Initial free credits granted.",
        idempotencyKey: `initial-free:${userId}`,
      },
    ],
    skipDuplicates: true,
  })

  return customerId
}

export async function activateSubscriptionCredits(params: {
  userId: string
  plan: PaidPlan
  status: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripeEventId?: string
}) {
  return prisma.$transaction(async (tx) => {
    const credit =
      (await tx.userCredit.findUnique({ where: { userId: params.userId } })) ||
      (await tx.userCredit.create({
        data: {
          userId: params.userId,
          freeCreditsRemaining: INITIAL_FREE_CREDITS,
        },
      }))

    const nextPlan = toBillingPlan(params.plan)
    const isActive = ACTIVE_STATUSES.has(params.status)
    const monthlyCredits = planCredits(nextPlan)
    const shouldGrant =
      isActive &&
      (credit.plan !== nextPlan || !ACTIVE_STATUSES.has(credit.subscriptionStatus) || credit.periodCreditsRemaining <= 0)
    const dates = shouldGrant ? nextMonthlyGrantDates() : null

    const updated = await tx.userCredit.update({
      where: { userId: params.userId },
      data: {
        plan: isActive ? nextPlan : BillingPlan.FREE,
        subscriptionStatus: params.status,
        stripeCustomerId: params.stripeCustomerId || credit.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId || credit.stripeSubscriptionId,
        periodCreditsRemaining: isActive ? (shouldGrant ? monthlyCredits : undefined) : 0,
        creditsPeriodStart: isActive ? dates?.creditsPeriodStart : null,
        creditsPeriodEnd: isActive ? dates?.creditsPeriodEnd : null,
        nextCreditGrantAt: isActive ? dates?.nextCreditGrantAt : null,
      },
    })

    if (shouldGrant) {
      await tx.creditTransaction.createMany({
        data: [
          {
            userId: params.userId,
            type: CreditTransactionType.GRANT,
            bucket: CreditBucket.PERIOD,
            amount: monthlyCredits,
            balanceAfterFree: updated.freeCreditsRemaining,
            balanceAfterPeriod: updated.periodCreditsRemaining,
            description: "Plan credits granted after subscription activation.",
            stripeEventId: params.stripeEventId,
            idempotencyKey: params.stripeEventId ? `stripe:${params.stripeEventId}:period-grant` : undefined,
            metadata: toJson({ plan: params.plan }),
          },
        ],
        skipDuplicates: true,
      })
    }

    return serializeCredit(updated)
  })
}

export function subscriptionStatusFromStripe(status: string | null | undefined) {
  const normalized = (status || "none").toUpperCase()
  if (normalized === "ACTIVE") return SubscriptionStatus.ACTIVE
  if (normalized === "TRIALING") return SubscriptionStatus.TRIALING
  if (normalized === "PAST_DUE") return SubscriptionStatus.PAST_DUE
  if (normalized === "CANCELED") return SubscriptionStatus.CANCELED
  if (normalized === "INCOMPLETE") return SubscriptionStatus.INCOMPLETE
  if (normalized === "INCOMPLETE_EXPIRED") return SubscriptionStatus.INCOMPLETE_EXPIRED
  if (normalized === "UNPAID") return SubscriptionStatus.UNPAID
  return SubscriptionStatus.NONE
}
