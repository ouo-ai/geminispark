import { CREDIT_COSTS } from "@/lib/billing-config"
import { ensureUserCredit, getWorkspaceStatus } from "@/lib/credits"
import { auth } from "@/lib/auth"
import { ensureOpenClawWorkspaceDirect } from "@/lib/openclaw-workspace"

import { getAgentApiAuthHeaders, getAgentApiUrl } from "../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function ensureWorkspaceViaAgentApi(userId: string) {
  const agentApiUrl = getAgentApiUrl()
  if (!agentApiUrl || !process.env.AGENT_API_TOKEN) {
    return null
  }

  try {
    const response = await fetch(`${agentApiUrl}/workspaces`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...getAgentApiAuthHeaders(userId),
      },
      body: JSON.stringify({ externalUserId: userId }),
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as Awaited<ReturnType<typeof getWorkspaceStatus>>
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user.id) {
    return Response.json({ error: "Sign in to initialize Gemini Spark." }, { status: 401 })
  }

  const [credits, initializedWorkspace] = await Promise.all([
    ensureUserCredit(session.user.id),
    ensureWorkspaceViaAgentApi(session.user.id),
  ])
  const workspace =
    initializedWorkspace ||
    (await ensureOpenClawWorkspaceDirect(session.user.id)) ||
    (await getWorkspaceStatus(session.user.id))

  return Response.json({
    credits: {
      ...credits,
      costs: CREDIT_COSTS,
    },
    workspace,
  })
}
