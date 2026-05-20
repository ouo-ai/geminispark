import Stripe from "stripe"

import { BILLING_PLANS, isBillingInterval, isPaidPlan } from "@/lib/billing-config"
import { activateSubscriptionCredits, subscriptionStatusFromStripe } from "@/lib/credits"
import { prisma } from "@/lib/db"
import { getStripe, paidPlanFromPriceId } from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function firstString(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session) {
  if (!session.subscription) return null
  return typeof session.subscription === "string" ? session.subscription : session.subscription.id
}

function formatStripeAmount(amount: number | null, currency: string | null) {
  if (amount === null) {
    return "unknown"
  }

  const normalizedCurrency = (currency || "usd").toUpperCase()
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
  }).format(amount / 100)
}

function formatChinaTime(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
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

  const subscriptionId = subscriptionIdFromSession(session)
  if (!subscriptionId) {
    return
  }

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
  await syncSubscription(subscription, stripeEventId)
}

async function sendFeishuText(text: string) {
  const webhookUrl = process.env.FEISHU_PAYMENT_WEBHOOK_URL
  if (!webhookUrl) {
    return
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      msg_type: "text",
      content: {
        text,
      },
    }),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Feishu webhook returned ${response.status}.`)
  }

  if (responseText.trim()) {
    try {
      const result = JSON.parse(responseText) as { code?: number; StatusCode?: number; msg?: string; StatusMessage?: string }
      const code = typeof result.code === "number" ? result.code : result.StatusCode
      if (typeof code === "number" && code !== 0) {
        throw new Error(result.msg || result.StatusMessage || `Feishu webhook returned code ${code}.`)
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return
      }

      throw error
    }
  }
}

async function notifyPaymentSuccess(session: Stripe.Checkout.Session, stripeEventId: string) {
  if (session.payment_status !== "paid") {
    return
  }

  const metadataPlan = session.metadata?.plan
  const metadataInterval = session.metadata?.interval
  const plan = isPaidPlan(metadataPlan) ? metadataPlan : null
  const interval = isBillingInterval(metadataInterval) ? metadataInterval : null
  const userId = session.metadata?.userId || null
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
    : null
  const planLabel = plan ? BILLING_PLANS[plan].label : "Unknown plan"
  const intervalLabel = interval === "year" ? "年付" : interval === "month" ? "月付" : "未知周期"
  const subscriptionId = subscriptionIdFromSession(session)
  const buyer = user?.email || session.customer_details?.email || user?.name || userId || "unknown"

  await sendFeishuText(
    [
      "Gemini Spark 购买成功",
      `套餐：${planLabel}（${intervalLabel}）`,
      `金额：${formatStripeAmount(session.amount_total, session.currency)}`,
      `用户：${buyer}`,
      `Stripe Checkout：${session.id}`,
      `Stripe Subscription：${subscriptionId || "-"}`,
      `Stripe Event：${stripeEventId}`,
      `时间：${formatChinaTime()}`,
    ].join("\n"),
  )
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
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      await syncCheckoutSession(checkoutSession, event.id)
      await notifyPaymentSuccess(checkoutSession, event.id).catch((error) => {
        console.error("Feishu payment notification failed:", error)
      })
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
