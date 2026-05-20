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
    monthlyCredits: 100,
    monthlyPriceUsd: 100,
    yearlyPriceUsd: 1000,
  },
  PRO: {
    label: "Pro",
    monthlyCredits: 250,
    monthlyPriceUsd: 200,
    yearlyPriceUsd: 2000,
  },
} as const

export type PaidPlan = keyof typeof BILLING_PLANS
export type BillingInterval = "month" | "year"

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "STARTUP" || value === "PRO"
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year"
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function stripePriceEnvName(plan: PaidPlan, interval: BillingInterval) {
  return `STRIPE_${plan}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRICE_ID`
}
