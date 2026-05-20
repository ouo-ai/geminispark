import { NextResponse } from "next/server"

import { getAgentApiAuthHeaders, getAgentApiUrl, getSessionOwnerId } from "../tasks/proxy"

type ClientAttachment = {
  name: string
  type: string
  dataUrl: string
}

type ClientMessage = {
  role: "assistant" | "user"
  body: string
}

type AgentRequest = {
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
function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AgentRequest
    const message = payload.message?.trim()

    if (!message) {
      return jsonError("Message is required.")
    }

    if (!payload.projectAgentId || !payload.chatThreadId) {
      return jsonError("Project and chat thread are required.", 400)
    }

    const agentApiUrl = getAgentApiUrl()

    if (!agentApiUrl) {
      return jsonError("Gemini Spark task API is not configured.", 500)
    }

    const ownerId = await getSessionOwnerId(request)
    if (!ownerId) {
      return jsonError("Sign in to chat with Gemini Spark.", 401)
    }

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
      }),
    })
    const body = await response.json()

    return NextResponse.json(body, { status: response.ok ? 202 : response.status })
  } catch {
    return jsonError(`${PUBLIC_AGENT_NAME} request failed. Please try again.`, 502)
  }
}
