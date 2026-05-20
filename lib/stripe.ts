import Stripe from "stripe"

import {
  isBillingInterval,
  isCreditPack,
  isPaidPlan,
  stripeCreditPackPriceEnvName,
  stripePriceEnvName,
  type BillingInterval,
  type CreditPack,
  type PaidPlan,
} from "@/lib/billing-config"

let stripeClient: Stripe | undefined

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.")
  }

  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY)
  return stripeClient
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "")
}

export function parseCheckoutPlan(value: unknown): PaidPlan {
  if (!isPaidPlan(value)) {
    throw new Error("Unsupported billing plan.")
  }

  return value
}

export function parseCheckoutCreditPack(value: unknown): CreditPack {
  if (!isCreditPack(value)) {
    throw new Error("Unsupported credit pack.")
  }

  return value
}

export function parseCheckoutInterval(value: unknown): BillingInterval {
  if (!isBillingInterval(value)) {
    throw new Error("Unsupported billing interval.")
  }

  return value
}

export function getStripePriceId(plan: PaidPlan, interval: BillingInterval) {
  const envName = stripePriceEnvName(plan, interval)
  const priceId = process.env[envName]
  if (!priceId) {
    throw new Error(`${envName} is not configured.`)
  }

  return priceId
}

export function getStripeCreditPackPriceId(pack: CreditPack) {
  const envName = stripeCreditPackPriceEnvName(pack)
  const priceId = process.env[envName]
  if (!priceId) {
    throw new Error(`${envName} is not configured.`)
  }

  return priceId
}

export function paidPlanFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) {
    return null
  }

  for (const plan of ["STARTUP", "PRO"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (process.env[stripePriceEnvName(plan, interval)] === priceId) {
        return plan
      }
    }
  }

  return null
}
