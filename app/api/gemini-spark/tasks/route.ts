import { getAgentApiAuthHeaders, getSessionOwnerId, jsonError, proxyJsonResponse, requireAgentApiUrl } from "./proxy"
import { getPostHogClient } from "@/lib/posthog-server"

type ClientAttachment = {
  name: string
  type: string
  dataUrl?: string
  url?: string
}

type ClientMessage = {
  role: "assistant" | "user"
  body: string
}

type AgentTaskRequest = {
  message: string
  attachments?: ClientAttachment[]
  history?: ClientMessage[]
  sessionId?: string
  clientTaskId?: string
  externalUserId?: string
  projectAgentId?: string
  chatThreadId?: string
}

const PUBLIC_AGENT_NAME = "Gemini Spark"

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AgentTaskRequest
    const message = payload.message?.trim()

    if (!message) {
      return jsonError("Message is required.")
    }

    if (!payload.projectAgentId || !payload.chatThreadId) {
      return jsonError("Project and chat thread are required.", 400)
    }

    const ownerId = await getSessionOwnerId(request)
    if (!ownerId) {
      return jsonError("Sign in to chat with Gemini Spark.", 401)
    }

    const agentApiUrl = requireAgentApiUrl()
    const response = await fetch(`${agentApiUrl}/tasks`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...getAgentApiAuthHeaders(ownerId),
      },
      body: JSON.stringify({
        ...payload,
        message,
        externalUserId: ownerId,
        projectAgentId: payload.projectAgentId,
        chatThreadId: payload.chatThreadId,
      }),
    })

    getPostHogClient().capture({
      distinctId: ownerId,
      event: "agent_task_submitted",
      properties: {
        project_agent_id: payload.projectAgentId,
        chat_thread_id: payload.chatThreadId,
        has_attachments: Boolean(payload.attachments?.length),
        attachment_count: payload.attachments?.length ?? 0,
      },
    })

    return proxyJsonResponse(response, 202)
  } catch {
    return jsonError(`${PUBLIC_AGENT_NAME} request failed. Please try again.`, 502)
  }
}
