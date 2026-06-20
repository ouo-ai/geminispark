import Stripe from "stripe"

import { BILLING_PLANS, CREDIT_PACKS, isBillingInterval, isCreditPack, isPaidPlan } from "@/lib/billing-config"
import { activateSubscriptionCredits, grantCreditPackCredits, subscriptionStatusFromStripe } from "@/lib/credits"
import { prisma } from "@/lib/db"
import { getStripe, paidPlanFromPrice } from "@/lib/stripe"
import { getPostHogClient } from "@/lib/posthog-server"

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

function paymentIntentIdFromSession(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) return null
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const directSubscription = stripeObjectId(
    (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription,
  )
  if (directSubscription) {
    return directSubscription
  }

  return stripeObjectId(
    (invoice.parent?.subscription_details as { subscription?: string | { id: string } | null } | null | undefined)
      ?.subscription,
  )
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

function stripeObjectId(value: string | { id: string } | null | undefined) {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error")
}

async function userIdForCustomer(customerId: string | null) {
  if (!customerId) return null

  const credit = await prisma.userCredit.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })

  return credit?.userId || null
}

function billingIntervalFromSubscription(subscription: Stripe.Subscription): "month" | "year" {
  const metadataInterval = subscription.metadata.interval
  if (isBillingInterval(metadataInterval)) {
    return metadataInterval
  }

  const recurringInterval = subscription.items.data[0]?.price.recurring?.interval
  return recurringInterval === "year" ? "year" : "month"
}

function billingPeriodFromSubscription(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number
        current_period_end?: number
      })
    | undefined
  const periodStart = item?.current_period_start ? new Date(item.current_period_start * 1000) : null
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null

  return { periodStart, periodEnd }
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  options: { grantPeriodCredits?: boolean } = {},
) {
  const customerId = firstString(subscription.customer)
  const userId = subscription.metadata.userId || (await userIdForCustomer(customerId))
  if (!userId) {
    return
  }

  const firstItem = subscription.items.data[0]
  const planFromMetadata = subscription.metadata.plan
  const plan = isPaidPlan(planFromMetadata) ? planFromMetadata : paidPlanFromPrice(firstItem?.price)
  if (!plan) {
    return
  }

  const interval = billingIntervalFromSubscription(subscription)
  const status = subscriptionStatusFromStripe(subscription.status)
  const { periodStart, periodEnd } = billingPeriodFromSubscription(subscription)

  await activateSubscriptionCredits({
    userId,
    plan,
    interval,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeEventId,
    periodStart,
    periodEnd,
    grantPeriodCredits: options.grantPeriodCredits,
  })

  getPostHogClient().capture({
    distinctId: userId,
    event: "subscription_activated",
    properties: {
      plan,
      interval,
      status,
      stripe_subscription_id: subscription.id,
      stripe_event_id: stripeEventId,
    },
  })
}

async function syncCheckoutSession(session: Stripe.Checkout.Session, stripeEventId: string) {
  const userId = session.metadata?.userId
  const checkoutKind = session.metadata?.checkoutKind

  if (checkoutKind === "credit_pack") {
    const pack = session.metadata?.pack
    if (!userId || !isCreditPack(pack) || session.payment_status !== "paid") {
      return
    }

    await grantCreditPackCredits({
      userId,
      pack,
      stripeCustomerId: firstString(session.customer),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentIdFromSession(session),
      stripeEventId,
    })

    getPostHogClient().capture({
      distinctId: userId,
      event: "credit_pack_purchased",
      properties: {
        pack,
        credits: CREDIT_PACKS[pack].credits,
        amount_total: session.amount_total,
        currency: session.currency,
        stripe_checkout_session_id: session.id,
        stripe_event_id: stripeEventId,
      },
    })
    return
  }

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

async function syncPaidInvoice(invoice: Stripe.Invoice, stripeEventId: string) {
  if (invoice.status !== "paid") {
    return
  }

  const subscriptionId = subscriptionIdFromInvoice(invoice)
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

async function tryRunFeishuNotification(label: string, notify: () => Promise<void>) {
  try {
    await notify()
  } catch (error) {
    console.error(`Feishu ${label} notification failed:`, error)
  }
}

async function notifyPaymentSuccess(session: Stripe.Checkout.Session, stripeEventId: string) {
  if (session.payment_status !== "paid") {
    return
  }

  const checkoutKind = session.metadata?.checkoutKind
  const metadataPlan = session.metadata?.plan
  const metadataInterval = session.metadata?.interval
  const metadataPack = session.metadata?.pack
  const plan = isPaidPlan(metadataPlan) ? metadataPlan : null
  const interval = isBillingInterval(metadataInterval) ? metadataInterval : null
  const pack = isCreditPack(metadataPack) ? metadataPack : null
  const userId = session.metadata?.userId || null
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
    : null
  const subscriptionId = subscriptionIdFromSession(session)
  const paymentIntentId = paymentIntentIdFromSession(session)
  const buyer = user?.email || session.customer_details?.email || user?.name || userId || "unknown"
  const purchaseLines =
    checkoutKind === "credit_pack" && pack
      ? [
          "类型：积分包",
          `套餐：${CREDIT_PACKS[pack].label}（${CREDIT_PACKS[pack].credits} credits）`,
          `Stripe PaymentIntent：${paymentIntentId || "-"}`,
        ]
      : [
          "类型：订阅",
          `套餐：${plan ? BILLING_PLANS[plan].label : "Unknown plan"}（${
            interval === "year" ? "年付" : interval === "month" ? "月付" : "未知周期"
          }）`,
          `Stripe Subscription：${subscriptionId || "-"}`,
        ]

  await sendFeishuText(
    [
      "Gemini Spark 购买成功",
      ...purchaseLines,
      `金额：${formatStripeAmount(session.amount_total, session.currency)}`,
      `用户：${buyer}`,
      `Stripe Checkout：${session.id}`,
      `Stripe Event：${stripeEventId}`,
      `时间：${formatChinaTime()}`,
    ].join("\n"),
  )
}

async function notifyCheckoutFailure(session: Stripe.Checkout.Session, stripeEventId: string, reason: string) {
  const checkoutKind = session.metadata?.checkoutKind || "unknown"
  const metadataPlan = session.metadata?.plan
  const metadataInterval = session.metadata?.interval
  const metadataPack = session.metadata?.pack
  const plan = isPaidPlan(metadataPlan) ? metadataPlan : null
  const interval = isBillingInterval(metadataInterval) ? metadataInterval : null
  const pack = isCreditPack(metadataPack) ? metadataPack : null
  const userId = session.metadata?.userId || null
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
    : null
  const buyer = user?.email || session.customer_details?.email || user?.name || userId || "unknown"
  const purchaseLines =
    checkoutKind === "credit_pack" && pack
      ? [`类型：积分包`, `套餐：${CREDIT_PACKS[pack].label}（${CREDIT_PACKS[pack].credits} credits）`]
      : [
          `类型：订阅`,
          `套餐：${plan ? BILLING_PLANS[plan].label : "Unknown plan"}（${
            interval === "year" ? "年付" : interval === "month" ? "月付" : "未知周期"
          }）`,
        ]

  await sendFeishuText(
    [
      "Gemini Spark 支付失败",
      ...purchaseLines,
      `原因：${reason}`,
      `Payment Status：${session.payment_status || "-"}`,
      `金额：${formatStripeAmount(session.amount_total, session.currency)}`,
      `用户：${buyer}`,
      `Stripe Checkout：${session.id}`,
      `Stripe Subscription：${subscriptionIdFromSession(session) || "-"}`,
      `Stripe PaymentIntent：${paymentIntentIdFromSession(session) || "-"}`,
      `Stripe Event：${stripeEventId}`,
      `时间：${formatChinaTime()}`,
    ].join("\n"),
  )
}

async function notifyPaymentIntentFailure(paymentIntent: Stripe.PaymentIntent, stripeEventId: string) {
  const userId = paymentIntent.metadata.userId || null
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
    : null
  const buyer = user?.email || user?.name || userId || "unknown"

  await sendFeishuText(
    [
      "Gemini Spark 支付失败",
      "类型：PaymentIntent",
      `原因：${paymentIntent.last_payment_error?.message || "Payment intent failed."}`,
      `金额：${formatStripeAmount(paymentIntent.amount, paymentIntent.currency)}`,
      `用户：${buyer}`,
      `Stripe PaymentIntent：${paymentIntent.id}`,
      `Stripe Customer：${stripeObjectId(paymentIntent.customer) || "-"}`,
      `Stripe Event：${stripeEventId}`,
      `时间：${formatChinaTime()}`,
    ].join("\n"),
  )
}

async function notifyInvoiceFailure(invoice: Stripe.Invoice, stripeEventId: string) {
  const customerId = firstString(invoice.customer)
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  const userId = invoice.metadata?.userId || (await userIdForCustomer(customerId))
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
    : null
  const buyer = user?.email || user?.name || userId || customerId || "unknown"

  await sendFeishuText(
    [
      "Gemini Spark 支付失败",
      "类型：Invoice",
      `原因：${invoice.status || "invoice payment failed"}`,
      `金额：${formatStripeAmount(invoice.amount_due, invoice.currency)}`,
      `用户：${buyer}`,
      `Stripe Customer：${customerId || "-"}`,
      `Stripe Invoice：${invoice.id}`,
      `Stripe Subscription：${subscriptionId || "-"}`,
      `Stripe Event：${stripeEventId}`,
      `时间：${formatChinaTime()}`,
    ].join("\n"),
  )
}

async function notifyWebhookException(params: {
  stripeEventId?: string
  stripeEventType?: string
  error: unknown
}) {
  await sendFeishuText(
    [
      "Gemini Spark 支付 Webhook 异常",
      `事件：${params.stripeEventType || "-"}`,
      `Stripe Event：${params.stripeEventId || "-"}`,
      `异常：${errorMessage(params.error)}`,
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
    const message = errorMessage(error) || "Invalid webhook signature."
    return Response.json({ error: message }, { status: 400 })
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session
      await syncCheckoutSession(checkoutSession, event.id)
      await tryRunFeishuNotification("payment success", () => notifyPaymentSuccess(checkoutSession, event.id))
    }

    if (event.type === "checkout.session.async_payment_failed") {
      await tryRunFeishuNotification("checkout failure", () =>
        notifyCheckoutFailure(event.data.object as Stripe.Checkout.Session, event.id, "Async payment failed."),
      )
    }

    if (event.type === "checkout.session.expired") {
      await tryRunFeishuNotification("checkout expired", () =>
        notifyCheckoutFailure(event.data.object as Stripe.Checkout.Session, event.id, "Checkout session expired."),
      )
    }

    if (event.type === "payment_intent.payment_failed") {
      await tryRunFeishuNotification("payment intent failure", () =>
        notifyPaymentIntentFailure(event.data.object as Stripe.PaymentIntent, event.id),
      )
    }

    if (event.type === "invoice.payment_failed") {
      await tryRunFeishuNotification("invoice failure", () => notifyInvoiceFailure(event.data.object as Stripe.Invoice, event.id))
    }

    if (event.type === "invoice.payment_succeeded") {
      await syncPaidInvoice(event.data.object as Stripe.Invoice, event.id)
    }

    if (event.type === "customer.subscription.created") {
      await syncSubscription(event.data.object as Stripe.Subscription, event.id)
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object as Stripe.Subscription, event.id, { grantPeriodCredits: false })
    }

    return Response.json({ received: true })
  } catch (error) {
    await tryRunFeishuNotification("webhook exception", () =>
      notifyWebhookException({
        stripeEventId: event.id,
        stripeEventType: event.type,
        error,
      }),
    )
    const message = errorMessage(error) || "Stripe webhook failed."
    return Response.json({ error: message }, { status: 500 })
  }
}
