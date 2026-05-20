import { Prisma, WorkspaceStatus } from "@prisma/client"

import { getWorkspaceStatus } from "@/lib/credits"
import { prisma } from "@/lib/db"

type WorkspaceRecord = Prisma.UserWorkspaceGetPayload<Record<string, never>>

function gatewayUrl() {
  return (process.env.OPENCLAW_GATEWAY_URL || "").replace(/\/$/, "")
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/\bOpenClaw\b/g, "Gemini Spark") : "Gemini Spark workspace initialization failed."
}

async function parseGatewayResponse(response: Response) {
  const text = await response.text()
  let body: unknown = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : text || response.statusText
    throw new Error(message)
  }

  return body && typeof body === "object" ? (body as Record<string, unknown>) : {}
}

function failedWorkspace(existing: WorkspaceRecord | null, error: unknown) {
  return {
    provider: "openclaw",
    status: "failed",
    workspaceId: existing?.workspaceId || null,
    initializedAt: existing?.initializedAt?.toISOString() || null,
    lastUsedAt: existing?.lastUsedAt?.toISOString() || null,
    error: errorMessage(error),
  }
}

export async function ensureOpenClawWorkspaceDirect(userId: string) {
  const existing = await prisma.userWorkspace.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "openclaw",
      },
    },
  })

  if (existing?.status === WorkspaceStatus.READY && existing.workspaceId) {
    await prisma.userWorkspace.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date(), error: null },
    })
    return getWorkspaceStatus(userId)
  }

  const url = gatewayUrl()
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || ""
  if (!url || !token) {
    return null
  }

  try {
    const response = await fetch(`${url}/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
      cache: "no-store",
    })
    const body = await parseGatewayResponse(response)
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : typeof body.id === "string" ? body.id : ""

    if (!workspaceId) {
      throw new Error("Gemini Spark Gateway did not return a workspace id.")
    }

    await prisma.userWorkspace.upsert({
      where: {
        userId_provider: {
          userId,
          provider: "openclaw",
        },
      },
      create: {
        userId,
        provider: "openclaw",
        workspaceId,
        status: WorkspaceStatus.READY,
        initializedAt: new Date(),
        lastUsedAt: new Date(),
        error: null,
      },
      update: {
        workspaceId,
        status: WorkspaceStatus.READY,
        initializedAt: existing?.initializedAt || new Date(),
        lastUsedAt: new Date(),
        error: null,
      },
    })

    return getWorkspaceStatus(userId)
  } catch (error) {
    if (existing) {
      const updated = await prisma.userWorkspace.update({
        where: { id: existing.id },
        data: {
          status: WorkspaceStatus.FAILED,
          error: errorMessage(error),
        },
      })
      return failedWorkspace(updated, error)
    }

    return failedWorkspace(null, error)
  }
}
