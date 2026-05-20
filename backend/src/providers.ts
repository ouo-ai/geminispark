import { WorkspaceStatus } from "@prisma/client"

import { config, requireConfig } from "./config.js"
import { prisma } from "./db.js"
import type {
  AgentIntent,
  ClientAttachment,
  ClientMessage,
  ProviderEvent,
  ProviderResult,
  RuntimeRunSnapshot,
} from "./types.js"

const PUBLIC_AGENT_NAME = "Gemini Spark"

type ProviderContext = {
  taskId?: string
  userId?: string
  onEvent?: (event: ProviderEvent) => Promise<void> | void
}

function publicAgentText(value: string) {
  return value
    .replace(/\bOpenClaw\b/g, PUBLIC_AGENT_NAME)
    .replace(/anthropic\/claude[\w./-]*/gi, PUBLIC_AGENT_NAME)
    .replace(/\bclaude[\w./-]*4\.7[\w./-]*\b/gi, PUBLIC_AGENT_NAME)
    .replace(/\bclaude[\w./-]*opus[\w./-]*\b/gi, PUBLIC_AGENT_NAME)
    .replace(/\bClaude\s+(?:Opus\s+)?4\.7(?:\s+Opus)?\b/gi, PUBLIC_AGENT_NAME)
}

function publicEventData(value: unknown): unknown {
  if (typeof value === "string") {
    return publicAgentText(value)
  }

  if (Array.isArray(value)) {
    return value.map(publicEventData)
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      key === "model" && typeof entry === "string" ? PUBLIC_AGENT_NAME : publicEventData(entry),
    ]),
  )
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
      typeof body === "object" && body && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : text || response.statusText

    throw new Error(publicAgentText(message))
  }

  return body && typeof body === "object" ? (body as Record<string, unknown>) : {}
}

function extractUrls(body: unknown): string[] {
  const urls = new Set<string>()

  function visit(value: unknown) {
    if (!value) {
      return
    }

    if (typeof value === "string") {
      if (/^https?:\/\//.test(value) || value.startsWith("data:")) {
        urls.add(value)
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (typeof value === "object") {
      Object.values(value).forEach(visit)
    }
  }

  visit(body)
  return Array.from(urls)
}

function mediaKindFromUrls(urls: string[], fallback: "image" | "video") {
  if (urls.some((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url))) {
    return "video" as const
  }

  if (urls.some((url) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || url.startsWith("data:image/"))) {
    return "image" as const
  }

  return fallback
}

function mediaFallbackForIntent(intent: AgentIntent): "image" | "video" {
  return intent === "text-to-video" || intent === "image-to-video" ? "video" : "image"
}

function openClawHeaders() {
  return {
    Authorization: `Bearer ${requireConfig(config.openClawGatewayToken, "OpenClaw Gateway is missing OPENCLAW_GATEWAY_TOKEN.")}`,
    "Content-Type": "application/json",
  }
}

function requireOpenClawGatewayUrl() {
  return requireConfig(config.openClawGatewayUrl, "OpenClaw Gateway is missing OPENCLAW_GATEWAY_URL.")
}

function openClawString(value: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const entry = value[key]
    if (typeof entry === "string" && entry) {
      return entry
    }
  }

  return undefined
}

function openClawStatus(value: unknown): RuntimeRunSnapshot["status"] {
  const status = typeof value === "string" ? value.toLowerCase() : ""
  if (status === "succeeded" || status === "done" || status === "complete" || status === "completed") {
    return "succeeded"
  }

  if (status === "failed" || status === "error") {
    return "failed"
  }

  if (status === "canceled" || status === "cancelled") {
    return "canceled"
  }

  if (status === "queued") {
    return "queued"
  }

  return "running"
}

function openClawIntent(value: unknown, fallback: AgentIntent): AgentIntent {
  return value === "image" || value === "text-to-video" || value === "image-to-video" || value === "text"
    ? value
    : fallback
}

function openClawArtifacts(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is { url?: string; type?: string; text?: string } => Boolean(item && typeof item === "object"))
    .map((item) => ({
      ...item,
      text: typeof item.text === "string" ? publicAgentText(item.text) : item.text,
    }))
}

function openClawEvents(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : undefined,
      type: typeof item.type === "string" && item.type ? item.type : "openclaw",
      message: typeof item.message === "string" && item.message ? publicAgentText(item.message) : `${PUBLIC_AGENT_NAME} updated.`,
      data: publicEventData(item.data),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
    }))
}

function eventKey(event: ProviderEvent, index: number) {
  return event.id || `${event.createdAt || ""}:${event.type}:${event.message}:${index}`
}

async function emitOpenClawEvents(
  events: ProviderEvent[],
  emitted: Set<string>,
  onEvent: ProviderContext["onEvent"],
) {
  if (!onEvent) {
    return
  }

  for (const [index, event] of events.entries()) {
    const key = eventKey(event, index)
    if (emitted.has(key)) {
      continue
    }

    emitted.add(key)
    await onEvent(event)
  }
}

function snapshotFromOpenClawRun(run: Record<string, unknown>, fallbackIntent: AgentIntent = "text"): RuntimeRunSnapshot {
  const artifacts = openClawArtifacts(run.artifacts)
  const artifactUrls = artifacts
    .map((artifact) => artifact.url)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
  const mediaUrls = artifactUrls.length > 0 ? artifactUrls : extractUrls(run)
  const intent = openClawIntent(run.intent, fallbackIntent)
  const message =
    openClawString(run, "message", "summary", "output") ||
    artifacts.find((artifact) => typeof artifact.text === "string")?.text ||
    `${PUBLIC_AGENT_NAME} is working on this task.`

  return {
    intent,
    status: openClawStatus(run.status),
    provider: PUBLIC_AGENT_NAME,
    model: PUBLIC_AGENT_NAME,
    message: publicAgentText(message),
    taskId: openClawString(run, "taskId"),
    runtimeRunId: openClawString(run, "runId", "id"),
    runtimeSessionId: openClawString(run, "runtimeSessionId", "sessionId"),
    workspaceId: openClawString(run, "workspaceId"),
    media:
      mediaUrls.length > 0
        ? { type: mediaKindFromUrls(mediaUrls, mediaFallbackForIntent(intent)), urls: mediaUrls }
        : undefined,
    artifacts,
    events: openClawEvents(run.events),
    error: openClawString(run, "error"),
    raw: run,
  }
}

export async function ensureOpenClawWorkspace(userId: string) {
  const existing = await prisma.userWorkspace.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "openclaw",
      },
    },
  })

  if (existing?.status === WorkspaceStatus.READY && existing.workspaceId && existing.runtimeSessionId) {
    await prisma.userWorkspace.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date(), error: null },
    })
    return existing.workspaceId
  }

  const gatewayUrl = requireOpenClawGatewayUrl()
  const response = await fetch(`${gatewayUrl}/workspaces`, {
    method: "POST",
    headers: openClawHeaders(),
    body: JSON.stringify({ userId }),
  })
  const body = await parseGatewayResponse(response)
  const workspaceId = openClawString(body, "workspaceId", "id") || ""
  const runtimeSessionId = openClawString(body, "runtimeSessionId", "sessionId")
  const runtimeAgentId = openClawString(body, "runtimeAgentId", "agentId")

  if (!workspaceId) {
    throw new Error("OpenClaw Gateway did not return a workspace id.")
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
      runtimeSessionId,
      runtimeAgentId,
      status: WorkspaceStatus.READY,
      initializedAt: new Date(),
      lastUsedAt: new Date(),
      lastSyncedAt: new Date(),
      error: null,
    },
    update: {
      workspaceId,
      runtimeSessionId,
      runtimeAgentId,
      status: WorkspaceStatus.READY,
      initializedAt: existing?.initializedAt || new Date(),
      lastUsedAt: new Date(),
      lastSyncedAt: new Date(),
      error: null,
    },
  })

  return workspaceId
}

export async function callOpenClawRun(
  intent: AgentIntent,
  message: string,
  history: ClientMessage[] = [],
  attachments: ClientAttachment[] = [],
  context: ProviderContext = {},
): Promise<ProviderResult> {
  if (!context.userId || !context.taskId) {
    throw new Error("OpenClaw task submission requires an authenticated user and task id.")
  }

  const gatewayUrl = requireOpenClawGatewayUrl()
  const workspaceId = await ensureOpenClawWorkspace(context.userId)
  const response = await fetch(`${gatewayUrl}/runs`, {
    method: "POST",
    headers: openClawHeaders(),
    body: JSON.stringify({
      taskId: context.taskId,
      userId: context.userId,
      workspaceId,
      intent,
      message,
      history,
      attachments,
    }),
  })
  const submitted = await parseGatewayResponse(response)
  const emittedEvents = new Set<string>()
  await emitOpenClawEvents(openClawEvents(submitted.events), emittedEvents, context.onEvent)
  const runId = openClawString(submitted, "runId", "id") || ""
  const runtimeSessionId = openClawString(submitted, "runtimeSessionId", "sessionId")

  if (!runId) {
    throw new Error("OpenClaw Gateway did not return a run id.")
  }

  return {
    intent,
    provider: PUBLIC_AGENT_NAME,
    model: PUBLIC_AGENT_NAME,
    workspaceId,
    taskId: runId,
    runtimeRunId: runId,
    runtimeSessionId,
    message: `${PUBLIC_AGENT_NAME} accepted the task.`,
    raw: submitted,
  }
}

export async function fetchOpenClawRunSnapshot(runId: string, fallbackIntent: AgentIntent = "text") {
  const gatewayUrl = requireOpenClawGatewayUrl()
  const response = await fetch(`${gatewayUrl}/runs/${encodeURIComponent(runId)}`, {
    headers: openClawHeaders(),
  })
  const run = await parseGatewayResponse(response)
  return snapshotFromOpenClawRun(run, fallbackIntent)
}

export async function runProviderForIntent(
  intent: AgentIntent,
  message: string,
  history: ClientMessage[] = [],
  attachments: ClientAttachment[] = [],
  context: ProviderContext = {},
) {
  return callOpenClawRun(intent, message, history, attachments, context)
}
