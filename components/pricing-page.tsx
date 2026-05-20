"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ImageIcon,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Video,
  WalletCards,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { BILLING_PLANS, CREDIT_COSTS, CREDIT_PACKS, type BillingInterval, type CreditPack, type PaidPlan } from "@/lib/billing-config"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const paidPlanOrder = ["STARTUP", "PRO"] as const
const creditPackOrder = ["BOOST_50", "STUDIO_150", "LAUNCH_400"] as const
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const usageCosts = [
  { label: "Chat", cost: CREDIT_COSTS.text, icon: MessageSquare },
  { label: "Image", cost: CREDIT_COSTS.image, icon: ImageIcon },
  { label: "Video", cost: CREDIT_COSTS["text-to-video"], icon: Video },
]

function formatMoney(value: number) {
  return moneyFormatter.format(value)
}

function yearlySavings(plan: PaidPlan) {
  const details = BILLING_PLANS[plan]
  return Math.round((1 - details.yearlyPriceUsd / (details.monthlyPriceUsd * 12)) * 100)
}

function priceForInterval(plan: PaidPlan, interval: BillingInterval) {
  const details = BILLING_PLANS[plan]
  return interval === "year" ? details.yearlyPriceUsd : details.monthlyPriceUsd
}

function perCreditLabel(credits: number, priceUsd: number) {
  return `$${(priceUsd / credits).toFixed(2)} / credit`
}

function creditEquivalents(credits: number) {
  return {
    chats: Math.floor(credits / CREDIT_COSTS.text),
    images: Math.floor(credits / CREDIT_COSTS.image),
    videos: Math.floor(credits / CREDIT_COSTS["text-to-video"]),
  }
}

export function PricingPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("year")
  const [pendingCheckout, setPendingCheckout] = useState<string | null>(null)
  const [billingError, setBillingError] = useState("")
  const [billingStatus, setBillingStatus] = useState<"success" | "cancel" | "">("")
  const isSignedIn = Boolean(session?.user)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get("billing")
    if (status === "success" || status === "cancel") {
      setBillingStatus(status)
    }
  }, [])

  function signInForCheckout() {
    void authClient.signIn.social({
      provider: "google",
      callbackURL: "/pricing",
    })
  }

  async function startCheckout(payload: Record<string, unknown>, pendingKey: string) {
    if (!isSignedIn) {
      signInForCheckout()
      return
    }

    setBillingError("")
    setBillingStatus("")
    setPendingCheckout(pendingKey)

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          returnPath: "/pricing",
        }),
      })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout could not be started.")
      }

      window.location.assign(data.url)
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Checkout could not be started.")
      setPendingCheckout(null)
    }
  }

  function startPlanCheckout(plan: PaidPlan) {
    void startCheckout({ checkoutKind: "subscription", plan, interval: billingInterval }, `plan:${plan}`)
  }

  function startCreditPackCheckout(pack: CreditPack) {
    void startCheckout({ checkoutKind: "credit_pack", pack }, `pack:${pack}`)
  }

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[760px] w-[1280px] -translate-x-1/2 bg-cover bg-center opacity-55"
          style={{
            backgroundImage: "url('/grade.png')",
            maskImage: "linear-gradient(to bottom, rgb(0 0 0), transparent 82%)",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,oklch(0.07_0.005_250)_86%)]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Current Gemini Spark plans
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Plans for agent work that moves between chat, images, and video.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Start with an annual plan for monthly credits, then add one-time credit packs whenever a launch or media batch needs extra capacity.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background/70 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Credit meter</p>
                <p className="mt-1 text-xs text-muted-foreground">One currency across the workspace.</p>
              </div>
              <WalletCards className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-4 grid gap-2">
              {usageCosts.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-md border border-border/70 bg-card/60 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground">
                    <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.cost} credit{item.cost > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {billingStatus && (
          <div
            className={cn(
              "mt-10 rounded-lg border px-4 py-3 text-sm",
              billingStatus === "success"
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-border bg-card/70 text-muted-foreground",
            )}
            role="status"
          >
            {billingStatus === "success"
              ? "Checkout completed. Credits update after Stripe confirms the payment."
              : "Checkout was canceled. No changes were made."}
          </div>
        )}

        <div className="mt-10 flex flex-col gap-4 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Paid plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">Annual billing is selected by default.</p>
          </div>
          <div className="flex w-fit rounded-full border border-border bg-background/70 p-1">
            {(["year", "month"] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                  billingInterval === interval ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={billingInterval === interval}
              >
                {interval === "year" && <CalendarDays className="h-4 w-4" aria-hidden="true" />}
                {interval === "year" ? "Yearly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {paidPlanOrder.map((plan) => {
            const details = BILLING_PLANS[plan]
            const price = priceForInterval(plan, billingInterval)
            const pendingKey = `plan:${plan}`
            const isPending = pendingCheckout === pendingKey
            const effectiveMonthly = billingInterval === "year" ? details.yearlyPriceUsd / 12 : details.monthlyPriceUsd
              const yearlyCredits = details.monthlyCredits * 12
              const cycleCredits = billingInterval === "year" ? yearlyCredits : details.monthlyCredits
              const equivalents = creditEquivalents(cycleCredits)

              return (
              <article
                key={plan}
                className={cn(
                  "relative rounded-lg border bg-card/80 p-5 backdrop-blur-xl",
                  plan === "PRO" ? "border-primary/45 shadow-[0_0_0_1px_oklch(0.68_0.19_255_/_0.12)]" : "border-border",
                )}
              >
                {plan === "PRO" && (
                  <span className="absolute right-4 top-4 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Most capacity
                  </span>
                )}
                <div className="max-w-[72%]">
                  <h3 className="text-2xl font-semibold text-foreground">{details.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {billingInterval === "year"
                      ? `${yearlyCredits} credits are available immediately after annual checkout.`
                      : `${details.monthlyCredits} credits refresh every month for active agent work.`}
                  </p>
                </div>
                <div className="mt-8 flex items-end gap-2">
                  <span className="text-4xl font-semibold text-foreground">{formatMoney(price)}</span>
                  <span className="pb-1 text-sm text-muted-foreground">/{billingInterval === "year" ? "year" : "month"}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {billingInterval === "year"
                    ? `${formatMoney(effectiveMonthly)} per month equivalent. Save ${yearlySavings(plan)}%, with all credits upfront.`
                    : "Switch to yearly for two months included."}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border/70 bg-background/55 p-3">
                    <p className="text-xl font-semibold text-foreground">{cycleCredits}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {billingInterval === "year" ? "credits today" : "credits / month"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/55 p-3">
                    <p className="text-xl font-semibold text-foreground">{billingInterval === "year" ? "12 mo" : "1 mo"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">access period</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/55 p-3">
                    <p className="text-xl font-semibold text-foreground">{equivalents.videos}</p>
                    <p className="mt-1 text-xs text-muted-foreground">video tasks</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    {billingInterval === "year"
                      ? `${yearlyCredits} credits granted immediately for the year`
                      : `${details.monthlyCredits} credits added each month`}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    Up to {equivalents.chats} chats, {equivalents.images} images, or {equivalents.videos} videos{" "}
                    {billingInterval === "year" ? "from annual credits" : "monthly"}
                  </span>
                  {billingInterval === "year" && (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                      No monthly wait; next plan refresh is in 12 months
                    </span>
                  )}
                  {billingInterval === "month" && (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                      Next plan credit refresh is in 1 month
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    Project workspace access with chat history
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    Stripe billing management
                  </span>
                </div>
                <Button
                  type="button"
                  rounded="lg"
                  className="mt-7 w-full gap-2"
                  disabled={isSessionPending || pendingCheckout !== null}
                  onClick={() => startPlanCheckout(plan)}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
                  {isSignedIn ? `Start ${details.label}` : "Sign in to buy"}
                </Button>
              </article>
            )
          })}
        </div>

        <div className="mt-14 grid gap-4 border-t border-border pt-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-foreground">Credit packs</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              One-time credits are added on top of your plan and are useful when a project has a short burst of generation work.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {creditPackOrder.map((pack) => {
              const details = CREDIT_PACKS[pack]
              const pendingKey = `pack:${pack}`
              const isPending = pendingCheckout === pendingKey
              const equivalents = creditEquivalents(details.credits)

              return (
                <article key={pack} className="rounded-lg border border-border bg-card/80 p-5 backdrop-blur-xl">
                  <div className="flex min-h-[112px] flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{details.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{details.description}</p>
                    </div>
                    <p className="mt-4 text-xs font-medium text-primary">{perCreditLabel(details.credits, details.priceUsd)}</p>
                  </div>
                  <div className="mt-6">
                    <div className="text-3xl font-semibold text-foreground">{formatMoney(details.priceUsd)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{details.credits} credits</div>
                  </div>
                  <div className="mt-5 grid gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center justify-between gap-2">
                      <span>Chat tasks</span>
                      <span className="font-medium text-foreground">up to {equivalents.chats}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span>Image tasks</span>
                      <span className="font-medium text-foreground">up to {equivalents.images}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span>Video tasks</span>
                      <span className="font-medium text-foreground">up to {equivalents.videos}</span>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    rounded="lg"
                    className="mt-6 w-full gap-2 bg-transparent"
                    disabled={isSessionPending || pendingCheckout !== null}
                    onClick={() => startCreditPackCheckout(pack)}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WalletCards className="h-4 w-4" aria-hidden="true" />}
                    {isSignedIn ? "Buy pack" : "Sign in to buy"}
                  </Button>
                </article>
              )
            })}
          </div>
        </div>

        {billingError && (
          <p className="mt-6 rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {billingError}
          </p>
        )}

        <div className="mt-12 flex flex-col gap-3 rounded-lg border border-border bg-background/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Need to use the workspace first?</p>
              <p className="mt-1 text-sm text-muted-foreground">Open chat to see your current credit balance after checkout.</p>
            </div>
          </div>
          <Button variant="ghost" rounded="lg" className="w-fit gap-2" asChild>
            <Link href="/gemini-spark">
              Open Chat
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
