import type { BillingInterval as PrismaBillingInterval, Prisma } from "@prisma/client"
import { BillingPlan, CreditBucket, CreditTransactionType, SubscriptionStatus } from "@prisma/client"

import {
  addMonths,
  BILLING_PLANS,
  CREDIT_PACKS,
  INITIAL_FREE_CREDITS,
  type BillingInterval,
  type CreditPack,
  type PaidPlan,
} from "@/lib/billing-config"
import { prisma } from "@/lib/db"

const ACTIVE_STATUSES = new Set<SubscriptionStatus>([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])
const PRISMA_BILLING_INTERVAL = {
  MONTH: "MONTH",
  YEAR: "YEAR",
} as const satisfies { MONTH: PrismaBillingInterval; YEAR: PrismaBillingInterval }
const MANUAL_MEMBER_EMAILS = new Set(["danke030210@gmail.com"])
const MANUAL_MEMBER_PLAN = BillingPlan.PRO
const MANUAL_MEMBER_INTERVAL = PRISMA_BILLING_INTERVAL.MONTH

type CreditRecord = Prisma.UserCreditGetPayload<Record<string, never>>

function cycleMonths(interval: PrismaBillingInterval | null | undefined) {
  return interval === PRISMA_BILLING_INTERVAL.YEAR ? 12 : 1
}

function planCredits(plan: BillingPlan, interval?: PrismaBillingInterval | null) {
  const multiplier = cycleMonths(interval)
  if (plan === BillingPlan.STARTUP) return BILLING_PLANS.STARTUP.monthlyCredits * multiplier
  if (plan === BillingPlan.PRO) return BILLING_PLANS.PRO.monthlyCredits * multiplier
  return 0
}

function toBillingPlan(plan: PaidPlan) {
  return plan === "STARTUP" ? BillingPlan.STARTUP : BillingPlan.PRO
}

function toPrismaBillingInterval(interval: BillingInterval) {
  return interval === "year" ? PRISMA_BILLING_INTERVAL.YEAR : PRISMA_BILLING_INTERVAL.MONTH
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

function serializeCredit(credit: CreditRecord) {
  return {
    freeCreditsRemaining: credit.freeCreditsRemaining,
    periodCreditsRemaining: credit.periodCreditsRemaining,
    totalCredits: credit.freeCreditsRemaining + credit.periodCreditsRemaining,
    plan: credit.plan.toLowerCase(),
    billingInterval: credit.billingInterval?.toLowerCase() || null,
    subscriptionStatus: credit.subscriptionStatus.toLowerCase(),
    creditsPeriodStart: credit.creditsPeriodStart?.toISOString() || null,
    creditsPeriodEnd: credit.creditsPeriodEnd?.toISOString() || null,
    nextCreditGrantAt: credit.nextCreditGrantAt?.toISOString() || null,
  }
}

async function syncManualMemberCredit(
  tx: Prisma.TransactionClient,
  credit: CreditRecord,
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
  const dates = shouldGrant ? nextGrantDates(MANUAL_MEMBER_INTERVAL, now) : null

  const updated = await tx.userCredit.update({
    where: { userId: credit.userId },
    data: {
      plan: MANUAL_MEMBER_PLAN,
      billingInterval: MANUAL_MEMBER_INTERVAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      periodCreditsRemaining: shouldGrant ? cycleCredits : undefined,
      creditsPeriodStart: dates?.creditsPeriodStart,
      creditsPeriodEnd: dates?.creditsPeriodEnd,
      nextCreditGrantAt: dates?.nextCreditGrantAt,
    },
  })

  if (shouldGrant && dates) {
    await tx.creditTransaction.createMany({
      data: [
        {
          userId: credit.userId,
          type: CreditTransactionType.GRANT,
          bucket: CreditBucket.PERIOD,
          amount: cycleCredits,
          balanceAfterFree: updated.freeCreditsRemaining,
          balanceAfterPeriod: updated.periodCreditsRemaining,
          description: "Manual member plan credits granted.",
          idempotencyKey: `manual-member:${credit.userId}:${MANUAL_MEMBER_INTERVAL.toLowerCase()}:${dates.creditsPeriodStart.toISOString()}`,
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

  return updated
}

function nextGrantDates(interval: PrismaBillingInterval | null | undefined, now = new Date()) {
  const periodEnd = addMonths(now, cycleMonths(interval))
  return {
    creditsPeriodStart: now,
    creditsPeriodEnd: periodEnd,
    nextCreditGrantAt: periodEnd,
  }
}

function explicitGrantDates(periodStart: Date | null | undefined, periodEnd: Date | null | undefined) {
  if (!periodStart || !periodEnd || periodEnd <= periodStart) {
    return null
  }

  return {
    creditsPeriodStart: periodStart,
    creditsPeriodEnd: periodEnd,
    nextCreditGrantAt: periodEnd,
  }
}

async function syncCreditPeriod(tx: Prisma.TransactionClient, credit: CreditRecord, now = new Date()) {
  const interval = credit.billingInterval || PRISMA_BILLING_INTERVAL.MONTH
  const cycleCredits = planCredits(credit.plan, interval)
  if (!ACTIVE_STATUSES.has(credit.subscriptionStatus) || cycleCredits <= 0) {
    return credit
  }

  if (credit.nextCreditGrantAt && credit.nextCreditGrantAt > now) {
    return credit
  }

  const dates = nextGrantDates(interval, now)
  const updated = await tx.userCredit.update({
    where: { userId: credit.userId },
    data: {
      periodCreditsRemaining: cycleCredits,
      ...dates,
    },
  })

  await tx.creditTransaction.createMany({
    data: [
      {
        userId: credit.userId,
        type: CreditTransactionType.GRANT,
        bucket: CreditBucket.PERIOD,
        amount: cycleCredits,
        balanceAfterFree: updated.freeCreditsRemaining,
        balanceAfterPeriod: updated.periodCreditsRemaining,
        description: interval === PRISMA_BILLING_INTERVAL.YEAR ? "Annual plan credits granted." : "Monthly plan credits granted.",
        idempotencyKey: `credit-period:${credit.userId}:${interval.toLowerCase()}:${dates.creditsPeriodStart.toISOString()}`,
      },
    ],
    skipDuplicates: true,
  })

  return updated
}

export async function ensureUserCredit(userId: string) {
  return prisma.$transaction(async (tx) => {
    const manualMemberEmail = await manualMemberEmailForUser(tx, userId)
    const existing = await tx.userCredit.findUnique({ where: { userId } })
    if (existing) {
      if (manualMemberEmail) {
        const synced = await syncManualMemberCredit(tx, existing, manualMemberEmail)
        return serializeCredit(synced)
      }

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

    if (manualMemberEmail) {
      const synced = await syncManualMemberCredit(tx, created, manualMemberEmail)
      return serializeCredit(synced)
    }

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
    runtimeSessionId: workspace?.runtimeSessionId || null,
    runtimeAgentId: workspace?.runtimeAgentId || null,
    initializedAt: workspace?.initializedAt?.toISOString() || null,
    lastUsedAt: workspace?.lastUsedAt?.toISOString() || null,
    lastSyncedAt: workspace?.lastSyncedAt?.toISOString() || null,
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
  interval: BillingInterval
  status: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripeEventId?: string
  periodStart?: Date | null
  periodEnd?: Date | null
  grantPeriodCredits?: boolean
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
    const nextInterval = toPrismaBillingInterval(params.interval)
    const isActive = ACTIVE_STATUSES.has(params.status)
    const cycleCredits = planCredits(nextPlan, nextInterval)
    const now = new Date()
    const isPlanTransition =
      credit.plan !== nextPlan || credit.billingInterval !== nextInterval || !ACTIVE_STATUSES.has(credit.subscriptionStatus)
    const isPeriodDue = !credit.nextCreditGrantAt || credit.nextCreditGrantAt <= now
    const shouldGrant =
      isActive &&
      (isPlanTransition || (params.grantPeriodCredits !== false && isPeriodDue))
    const dates = shouldGrant ? explicitGrantDates(params.periodStart, params.periodEnd) || nextGrantDates(nextInterval, now) : null
    const periodGrantIdempotencyKey =
      dates && params.stripeSubscriptionId
        ? `stripe-subscription-period:${params.stripeSubscriptionId}:${params.plan}:${params.interval}:${dates.creditsPeriodStart.toISOString()}`
        : params.stripeEventId
          ? `stripe:${params.stripeEventId}:period-grant`
          : undefined

    const updated = await tx.userCredit.update({
      where: { userId: params.userId },
      data: {
        plan: isActive ? nextPlan : BillingPlan.FREE,
        billingInterval: isActive ? nextInterval : null,
        subscriptionStatus: params.status,
        stripeCustomerId: params.stripeCustomerId || credit.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId || credit.stripeSubscriptionId,
        periodCreditsRemaining: isActive ? (shouldGrant ? cycleCredits : undefined) : 0,
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
            amount: cycleCredits,
            balanceAfterFree: updated.freeCreditsRemaining,
            balanceAfterPeriod: updated.periodCreditsRemaining,
            description:
              params.interval === "year"
                ? "Annual plan credits granted after subscription activation."
                : "Monthly plan credits granted after subscription activation.",
            stripeEventId: params.stripeEventId,
            idempotencyKey: periodGrantIdempotencyKey,
            metadata: toJson({ plan: params.plan, interval: params.interval, credits: cycleCredits }),
          },
        ],
        skipDuplicates: true,
      })
    }

    return serializeCredit(updated)
  })
}

export async function grantCreditPackCredits(params: {
  userId: string
  pack: CreditPack
  stripeCustomerId?: string | null
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string | null
  stripeEventId?: string
}) {
  return prisma.$transaction(async (tx) => {
    const pack = CREDIT_PACKS[params.pack]
    const idempotencyKey = `stripe-checkout:${params.stripeCheckoutSessionId}:credit-pack`
    const existingTransaction = await tx.creditTransaction.findUnique({
      where: { idempotencyKey },
    })

    let credit = await tx.userCredit.findUnique({ where: { userId: params.userId } })

    if (!credit) {
      credit = await tx.userCredit.create({
        data: {
          userId: params.userId,
          freeCreditsRemaining: INITIAL_FREE_CREDITS,
          stripeCustomerId: params.stripeCustomerId || undefined,
        },
      })

      await tx.creditTransaction.createMany({
        data: [
          {
            userId: params.userId,
            type: CreditTransactionType.GRANT,
            bucket: CreditBucket.FREE,
            amount: INITIAL_FREE_CREDITS,
            balanceAfterFree: credit.freeCreditsRemaining,
            balanceAfterPeriod: credit.periodCreditsRemaining,
            description: "Initial free credits granted.",
            idempotencyKey: `initial-free:${params.userId}`,
          },
        ],
        skipDuplicates: true,
      })
    }

    if (existingTransaction) {
      return serializeCredit(credit)
    }

    credit = await tx.userCredit.update({
      where: { userId: params.userId },
      data: {
        freeCreditsRemaining: { increment: pack.credits },
        stripeCustomerId: params.stripeCustomerId || credit.stripeCustomerId,
      },
    })

    await tx.creditTransaction.create({
      data: {
        userId: params.userId,
        type: CreditTransactionType.GRANT,
        bucket: CreditBucket.FREE,
        amount: pack.credits,
        balanceAfterFree: credit.freeCreditsRemaining,
        balanceAfterPeriod: credit.periodCreditsRemaining,
        description: `${pack.label} credit pack purchased.`,
        stripeEventId: params.stripeEventId,
        idempotencyKey,
        metadata: toJson({
          pack: params.pack,
          credits: pack.credits,
          stripeCheckoutSessionId: params.stripeCheckoutSessionId,
          stripePaymentIntentId: params.stripePaymentIntentId,
        }),
      },
    })

    return serializeCredit(credit)
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
