import { canPurchaseCreditPack, CREDIT_COSTS } from "@/lib/billing-config"
import { ensureUserCredit } from "@/lib/credits"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user.id) {
    return Response.json({ error: "Sign in to view billing status." }, { status: 401 })
  }

  const credits = await ensureUserCredit(session.user.id)

  return Response.json({
    credits: {
      ...credits,
      costs: CREDIT_COSTS,
      canPurchaseCreditPack: canPurchaseCreditPack(credits),
    },
  })
}
