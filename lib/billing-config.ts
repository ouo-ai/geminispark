export const INITIAL_FREE_CREDITS = 2

export const CREDIT_COSTS = {
  text: 1,
  image: 5,
  "text-to-video": 10,
  "image-to-video": 10,
} as const

export const BILLING_PLANS = {
  STARTUP: {
    label: "Startup",
    monthlyCredits: 1000,
    monthlyPriceUsd: 100,
    yearlyPriceUsd: 1000,
  },
  PRO: {
    label: "Pro",
    monthlyCredits: 2500,
    monthlyPriceUsd: 200,
    yearlyPriceUsd: 2000,
  },
} as const

export const CREDIT_PACKS = {
  BOOST_50: {
    label: "Boost 50",
    credits: 50,
    priceUsd: 60,
    description: "A quick reserve for short image and chat runs.",
  },
  STUDIO_150: {
    label: "Studio 150",
    credits: 150,
    priceUsd: 150,
    description: "A balanced pack for mixed image, video, and planning work.",
  },
  LAUNCH_400: {
    label: "Launch 400",
    credits: 400,
    priceUsd: 360,
    description: "Best fit for campaign batches and longer video workflows.",
  },
} as const

export type PaidPlan = keyof typeof BILLING_PLANS
export type BillingInterval = "month" | "year"
export type CreditPack = keyof typeof CREDIT_PACKS

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "STARTUP" || value === "PRO"
}

export function isCreditPack(value: unknown): value is CreditPack {
  return value === "BOOST_50" || value === "STUDIO_150" || value === "LAUNCH_400"
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year"
}

export function isActiveSubscriptionStatus(value: unknown) {
  if (typeof value !== "string") {
    return false
  }

  const normalized = value.toLowerCase()
  return normalized === "active" || normalized === "trialing"
}

export function canPurchaseCreditPack(credit: { plan?: string | null; subscriptionStatus?: string | null }) {
  return typeof credit.plan === "string" && credit.plan.toLowerCase() !== "free" && isActiveSubscriptionStatus(credit.subscriptionStatus)
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function stripePriceEnvName(plan: PaidPlan, interval: BillingInterval) {
  return `STRIPE_${plan}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRICE_ID`
}

export function stripeCreditPackPriceEnvName(pack: CreditPack) {
  return `STRIPE_CREDIT_PACK_${pack}_PRICE_ID`
}

export function stripePriceLookupKey(plan: PaidPlan, interval: BillingInterval) {
  return `geminispark_${plan.toLowerCase()}_${interval === "year" ? "yearly" : "monthly"}`
}

export function stripeCreditPackPriceLookupKey(pack: CreditPack) {
  return `geminispark_credit_pack_${pack.toLowerCase()}`
}
