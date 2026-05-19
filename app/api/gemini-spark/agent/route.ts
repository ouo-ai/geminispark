import { NextResponse } from "next/server"

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

    const agentApiUrl = (process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || "").replace(/\/$/, "")

    if (!agentApiUrl) {
      return jsonError("Gemini Spark task API is not configured.", 500)
    }

    const response = await fetch(`${agentApiUrl}/tasks`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        message,
      }),
    })
    const body = await response.json()

    return NextResponse.json(body, { status: response.ok ? 202 : response.status })
  } catch {
    return jsonError(`${PUBLIC_AGENT_NAME} request failed. Please try again.`, 502)
  }
}
