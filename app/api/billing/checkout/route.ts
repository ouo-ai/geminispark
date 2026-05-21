import { BILLING_PLANS, canPurchaseCreditPack, CREDIT_PACKS } from "@/lib/billing-config"
import { ensureStripeCustomer, ensureUserCredit } from "@/lib/credits"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import {
  getSiteUrl,
  getStripe,
  getStripeCreditPackPriceId,
  getStripePriceId,
  parseCheckoutCreditPack,
  parseCheckoutInterval,
  parseCheckoutPlan,
} from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type CheckoutNotificationContext = {
  userId?: string | null
  userEmail?: string | null
  checkoutKind?: string | null
  plan?: unknown
  interval?: unknown
  pack?: unknown
}

function checkoutStatusUrl(siteUrl: string, returnPath: string, status: "success" | "cancel") {
  const url = new URL(returnPath, siteUrl)
  url.searchParams.set("billing", status)
  return url.toString()
}

function parseReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/gemini-spark"
  }

  return value
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error")
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

async function notifyCheckoutException(context: CheckoutNotificationContext, error: unknown) {
  try {
    await sendFeishuText(
      [
        "Gemini Spark Checkout 异常",
        `用户：${context.userEmail || context.userId || "unknown"}`,
        `类型：${context.checkoutKind || "unknown"}`,
        `套餐：${typeof context.plan === "string" ? context.plan : "-"}`,
        `周期：${typeof context.interval === "string" ? context.interval : "-"}`,
        `积分包：${typeof context.pack === "string" ? context.pack : "-"}`,
        `异常：${errorMessage(error)}`,
        `时间：${formatChinaTime()}`,
      ].join("\n"),
    )
  } catch (notificationError) {
    console.error("Feishu checkout exception notification failed:", notificationError)
  }
}

export async function POST(request: Request) {
  const notificationContext: CheckoutNotificationContext = {}

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    notificationContext.userId = session?.user.id
    notificationContext.userEmail = session?.user.email

    if (!session?.user.id) {
      return Response.json({ error: "Sign in to subscribe." }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email
    const userName = session.user.name
    const body = (await request.json()) as {
      checkoutKind?: unknown
      plan?: unknown
      interval?: unknown
      pack?: unknown
      returnPath?: unknown
    }
    const checkoutKind = body.checkoutKind === "credit_pack" || body.pack ? "credit_pack" : "subscription"
    notificationContext.checkoutKind = checkoutKind
    notificationContext.plan = body.plan
    notificationContext.interval = body.interval
    notificationContext.pack = body.pack
    const user = await prisma.user.findUnique({ where: { id: userId } })

    const credit = await ensureUserCredit(userId)
    let checkoutStripe: ReturnType<typeof getStripe> | undefined
    let checkoutCustomerId: string | undefined
    async function getCheckoutCustomer() {
      const stripe = checkoutStripe ?? getStripe()
      checkoutStripe = stripe
      const customerId =
        checkoutCustomerId ??
        (await ensureStripeCustomer(userId, async () => {
          const customer = await stripe.customers.create({
            email: user?.email || userEmail || undefined,
            name: user?.name || userName || undefined,
            metadata: {
              userId,
            },
          })

          return customer.id
        }))

      checkoutCustomerId = customerId
      return { stripe, customerId }
    }

    const siteUrl = getSiteUrl()
    const returnPath = parseReturnPath(body.returnPath)

    if (checkoutKind === "credit_pack") {
      const pack = parseCheckoutCreditPack(body.pack)
      if (!canPurchaseCreditPack(credit)) {
        return Response.json({ error: "Subscribe to a paid plan before buying credit packs." }, { status: 403 })
      }

      const { stripe, customerId } = await getCheckoutCustomer()
      const details = CREDIT_PACKS[pack]
      const priceId = await getStripeCreditPackPriceId(pack)
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: checkoutStatusUrl(siteUrl, returnPath, "success"),
        cancel_url: checkoutStatusUrl(siteUrl, returnPath, "cancel"),
        metadata: {
          userId,
          checkoutKind,
          pack,
          credits: String(details.credits),
        },
        payment_intent_data: {
          metadata: {
            userId,
            checkoutKind,
            pack,
            credits: String(details.credits),
          },
        },
      })

      return Response.json({ url: checkout.url })
    }

    const { stripe, customerId } = await getCheckoutCustomer()
    const plan = parseCheckoutPlan(body.plan)
    const interval = parseCheckoutInterval(body.interval || "month")
    const priceId = await getStripePriceId(plan, interval)
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: checkoutStatusUrl(siteUrl, returnPath, "success"),
      cancel_url: checkoutStatusUrl(siteUrl, returnPath, "cancel"),
      metadata: {
        userId,
        checkoutKind,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          userId,
          checkoutKind,
          plan,
          interval,
          monthlyCredits: String(BILLING_PLANS[plan].monthlyCredits),
        },
      },
    })

    return Response.json({ url: checkout.url })
  } catch (error) {
    await notifyCheckoutException(notificationContext, error)
    const message = errorMessage(error) || "Unable to start checkout."
    return Response.json({ error: message }, { status: 400 })
  }
}
