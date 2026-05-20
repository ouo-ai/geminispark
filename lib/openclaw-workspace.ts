import { Prisma, WorkspaceStatus } from "@prisma/client"

import { prisma } from "@/lib/db"
import { workspaceStatusFromProject } from "@/lib/project-agents"

type ProjectRecord = Prisma.ProjectAgentGetPayload<Record<string, never>>

function gatewayUrl() {
  return (process.env.OPENCLAW_GATEWAY_URL || "").replace(/\/$/, "")
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
        .replace(/\bOpenClaw\b/g, "Gemini Spark")
        .replace(/anthropic\/claude[\w./-]*/gi, "Gemini Spark")
        .replace(/\bclaude[\w./-]*4\.7[\w./-]*\b/gi, "Gemini Spark")
        .replace(/\bclaude[\w./-]*opus[\w./-]*\b/gi, "Gemini Spark")
        .replace(/\bClaude\s+(?:Opus\s+)?4\.7(?:\s+Opus)?\b/gi, "Gemini Spark")
    : "Gemini Spark workspace initialization failed."
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

function failedWorkspace(existing: ProjectRecord | null, error: unknown) {
  return {
    provider: "openclaw",
    status: "failed",
    workspaceId: existing?.workspaceId || null,
    runtimeAgentId: existing?.runtimeAgentId || null,
    initializedAt: existing?.workspaceId ? existing.updatedAt.toISOString() : null,
    lastUsedAt: existing?.updatedAt.toISOString() || null,
    lastSyncedAt: existing?.updatedAt.toISOString() || null,
    error: errorMessage(error),
  }
}

export async function ensureOpenClawWorkspaceDirect(userId: string, projectAgentId: string) {
  const existing = await prisma.projectAgent.findFirst({
    where: {
      id: projectAgentId,
      userId,
      archivedAt: null,
    },
  })

  if (existing?.status === WorkspaceStatus.READY && existing.workspaceId) {
    const updated = await prisma.projectAgent.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    })
    return workspaceStatusFromProject(updated)
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
      body: JSON.stringify({
        userId,
        projectAgentId,
        projectName: existing?.name,
        projectInstructions: existing?.instructions,
        projectMemorySummary: existing?.memorySummary,
      }),
      cache: "no-store",
    })
    const body = await parseGatewayResponse(response)
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : typeof body.id === "string" ? body.id : ""
    const runtimeAgentId = typeof body.runtimeAgentId === "string" ? body.runtimeAgentId : typeof body.agentId === "string" ? body.agentId : undefined

    if (!workspaceId) {
      throw new Error("Gemini Spark Gateway did not return a workspace id.")
    }

    if (!existing) {
      throw new Error("Project agent was not found.")
    }

    await prisma.projectAgent.update({
      where: { id: existing.id },
      data: {
        workspaceId,
        runtimeAgentId,
        status: WorkspaceStatus.READY,
      },
    })

    const project = await prisma.projectAgent.findUnique({ where: { id: existing.id } })
    return workspaceStatusFromProject(project)
  } catch (error) {
    if (existing) {
      const updated = await prisma.projectAgent.update({
        where: { id: existing.id },
        data: {
          status: WorkspaceStatus.FAILED,
        },
      })
      return failedWorkspace(updated, error)
    }

    return failedWorkspace(null, error)
  }
}
