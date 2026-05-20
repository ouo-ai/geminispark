import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

export const CLIENT_OWNER_HEADER = "x-geminispark-client-id"

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function getAgentApiUrl() {
  return (process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || "").replace(/\/$/, "")
}

export async function getSessionOwnerId(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  return session?.user.id || ""
}

export function requireAgentApiUrl() {
  const agentApiUrl = getAgentApiUrl()
  if (!agentApiUrl) {
    throw new Error("AGENT_API_URL is not configured.")
  }

  return agentApiUrl
}

export function getAgentApiAuthHeaders(ownerId: string) {
  if (!process.env.AGENT_API_TOKEN) {
    throw new Error("AGENT_API_TOKEN is not configured.")
  }

  return {
    Authorization: `Bearer ${process.env.AGENT_API_TOKEN}`,
    [CLIENT_OWNER_HEADER]: ownerId,
  }
}

export async function proxyJsonResponse(response: Response, successStatus = response.status) {
  const body = await response.json().catch(() => ({ error: "Agent API returned an invalid response." }))
  return NextResponse.json(body, { status: response.ok ? successStatus : response.status })
}
