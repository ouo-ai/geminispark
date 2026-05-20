import { CREDIT_COSTS } from "@/lib/billing-config"
import { getThreadMessagesForUser } from "@/lib/chat-history"
import { ensureUserCredit } from "@/lib/credits"
import { auth } from "@/lib/auth"
import { ensureOpenClawWorkspaceDirect } from "@/lib/openclaw-workspace"
import { ensureDefaultProjectBundle } from "@/lib/project-agents"

import { getAgentApiAuthHeaders, getAgentApiUrl } from "../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PUBLIC_AGENT_NAME = "Gemini Spark"

function publicAgentText(value: string) {
  return value
    .replace(/\bOpenClaw\b/g, PUBLIC_AGENT_NAME)
    .replace(/anthropic\/claude[\w./-]*/gi, PUBLIC_AGENT_NAME)
    .replace(/\bclaude[\w./-]*4\.7[\w./-]*\b/gi, PUBLIC_AGENT_NAME)
    .replace(/\bclaude[\w./-]*opus[\w./-]*\b/gi, PUBLIC_AGENT_NAME)
    .replace(/\bClaude\s+(?:Opus\s+)?4\.7(?:\s+Opus)?\b/gi, PUBLIC_AGENT_NAME)
}

async function safeJson(response: Response) {
  const text = await response.text()
  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function ensureWorkspaceViaAgentApi(userId: string, projectAgentId: string) {
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
      body: JSON.stringify({ externalUserId: userId, projectAgentId }),
      cache: "no-store",
    })

    const body = await safeJson(response)
    if (!response.ok || !body || typeof body !== "object") {
      return null
    }

    return body
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user.id) {
      return Response.json({ error: "Sign in to initialize Gemini Spark." }, { status: 401 })
    }

    const url = new URL(request.url)
    const requestedProjectId = url.searchParams.get("projectAgentId")
    const requestedThreadId = url.searchParams.get("chatThreadId")
    const [credits, bundle] = await Promise.all([
      ensureUserCredit(session.user.id),
      ensureDefaultProjectBundle(session.user.id, requestedProjectId, requestedThreadId),
    ])
    const hasReadyWorkspace = bundle.workspace.status === "ready" && Boolean(bundle.workspace.workspaceId)
    const initializedWorkspace = hasReadyWorkspace
      ? bundle.workspace
      : (await ensureWorkspaceViaAgentApi(session.user.id, bundle.activeProject.id)) ||
        (await ensureOpenClawWorkspaceDirect(session.user.id, bundle.activeProject.id)) ||
        bundle.workspace
    const messages = (await getThreadMessagesForUser(session.user.id, bundle.activeThread.id)) || []

    return Response.json({
      profile: bundle.profile,
      credits: {
        ...credits,
        costs: CREDIT_COSTS,
      },
      projects: bundle.projects,
      activeProject: bundle.activeProject,
      threads: bundle.threads,
      activeThread: bundle.activeThread,
      messages,
      workspace: initializedWorkspace,
    })
  } catch (error) {
    return Response.json(
      {
        error: publicAgentText(error instanceof Error ? error.message : "Gemini Spark workspace initialization failed."),
      },
      { status: 502 },
    )
  }
}
