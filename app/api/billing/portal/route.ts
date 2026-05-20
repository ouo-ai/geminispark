import { ensureUserCredit } from "@/lib/credits"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getSiteUrl, getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user.id) {
    return Response.json({ error: "Sign in to manage billing." }, { status: 401 })
  }

  await ensureUserCredit(session.user.id)
  const credit = await prisma.userCredit.findUnique({
    where: { userId: session.user.id },
  })

  if (!credit?.stripeCustomerId) {
    return Response.json({ error: "No billing customer found." }, { status: 404 })
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: credit.stripeCustomerId,
    return_url: `${getSiteUrl()}/gemini-spark`,
  })

  return Response.json({ url: portal.url })
}
