import { BILLING_PLANS } from "@/lib/billing-config"
import { ensureStripeCustomer, ensureUserCredit } from "@/lib/credits"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getSiteUrl, getStripe, getStripePriceId, parseCheckoutInterval, parseCheckoutPlan } from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user.id) {
      return Response.json({ error: "Sign in to subscribe." }, { status: 401 })
    }

    const body = (await request.json()) as { plan?: unknown; interval?: unknown }
    const plan = parseCheckoutPlan(body.plan)
    const interval = parseCheckoutInterval(body.interval || "year")
    const priceId = getStripePriceId(plan, interval)
    const stripe = getStripe()
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })

    await ensureUserCredit(session.user.id)
    const customerId = await ensureStripeCustomer(session.user.id, async () => {
      const customer = await stripe.customers.create({
        email: user?.email || session.user.email || undefined,
        name: user?.name || session.user.name || undefined,
        metadata: {
          userId: session.user.id,
        },
      })

      return customer.id
    })

    const siteUrl = getSiteUrl()
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/gemini-spark?billing=success`,
      cancel_url: `${siteUrl}/gemini-spark?billing=cancel`,
      metadata: {
        userId: session.user.id,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan,
          interval,
          monthlyCredits: String(BILLING_PLANS[plan].monthlyCredits),
        },
      },
    })

    return Response.json({ url: checkout.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start checkout."
    return Response.json({ error: message }, { status: 400 })
  }
}
