import Stripe from "stripe"

import { isPaidPlan } from "@/lib/billing-config"
import { activateSubscriptionCredits, subscriptionStatusFromStripe } from "@/lib/credits"
import { prisma } from "@/lib/db"
import { getStripe, paidPlanFromPriceId } from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function firstString(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

async function userIdForCustomer(customerId: string | null) {
  if (!customerId) return null

  const credit = await prisma.userCredit.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })

  return credit?.userId || null
}

async function syncSubscription(subscription: Stripe.Subscription, stripeEventId: string) {
  const customerId = firstString(subscription.customer)
  const userId = subscription.metadata.userId || (await userIdForCustomer(customerId))
  if (!userId) {
    return
  }

  const firstItem = subscription.items.data[0]
  const planFromMetadata = subscription.metadata.plan
  const plan = isPaidPlan(planFromMetadata) ? planFromMetadata : paidPlanFromPriceId(firstItem?.price?.id)
  if (!plan) {
    return
  }

  await activateSubscriptionCredits({
    userId,
    plan,
    status: subscriptionStatusFromStripe(subscription.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeEventId,
  })
}

async function syncCheckoutSession(session: Stripe.Checkout.Session, stripeEventId: string) {
  const userId = session.metadata?.userId
  if (!userId || !session.subscription) {
    return
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
  await syncSubscription(subscription, stripeEventId)
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature."
    return Response.json({ error: message }, { status: 400 })
  }

  try {
    if (event.type === "checkout.session.completed") {
      await syncCheckoutSession(event.data.object as Stripe.Checkout.Session, event.id)
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription, event.id)
    }

    return Response.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook failed."
    return Response.json({ error: message }, { status: 500 })
  }
}
