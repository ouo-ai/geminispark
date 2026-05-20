import { WorkspaceStatus } from "@prisma/client"

import { config, requireConfig } from "./config.js"
import { prisma } from "./db.js"
import type { AgentIntent, ClientAttachment, ClientMessage, ProviderEvent, ProviderResult } from "./types.js"

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-opus-4.7"
const APIMART_IMAGE_MODEL = process.env.APIMART_IMAGE_MODEL || "gpt-image-2"
const EGG_TEXT_TO_VIDEO_MODEL = process.env.EGG_TEXT_TO_VIDEO_MODEL || "alibaba/wan-2.7/text-to-video"
const EGG_IMAGE_TO_VIDEO_MODEL = process.env.EGG_IMAGE_TO_VIDEO_MODEL || "alibaba/wan-2.7/image-to-video"
const PUBLIC_AGENT_NAME = "Gemini Spark"

type ProviderContext = {
  taskId?: string
  userId?: string
  onEvent?: (event: ProviderEvent) => Promise<void> | void
}

function compactHistory(history: ClientMessage[] = []) {
  return history.slice(-8).map((message) => ({
    role: message.role,
    content: message.body,
  }))
}

async function parseProviderResponse(response: Response) {
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

    throw new Error(message)
  }

  return body
}

function findTaskId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined
  }

  const data = (body as { data?: unknown }).data

  if (Array.isArray(data)) {
    const first = data[0]
    if (first && typeof first === "object") {
      return (
        (first as { task_id?: string }).task_id ||
        (first as { id?: string }).id ||
        (first as { taskId?: string }).taskId
      )
    }
  }

  if (data && typeof data === "object") {
    return (
      (data as { task_id?: string }).task_id ||
      (data as { id?: string }).id ||
      (data as { taskId?: string }).taskId
    )
  }

  return (
    (body as { task_id?: string }).task_id ||
    (body as { id?: string }).id ||
    (body as { taskId?: string }).taskId
  )
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

function attachmentUrl(attachment: ClientAttachment) {
  return attachment.url || attachment.dataUrl || ""
}

async function parseOpenClawResponse(response: Response) {
  const body = await parseProviderResponse(response)
  if (!body || typeof body !== "object") {
    return {}
  }

  return body as Record<string, unknown>
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

function openClawStatus(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : ""
}

function openClawArtifacts(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is { url?: string; type?: string; text?: string } => Boolean(item && typeof item === "object"))
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
      message: typeof item.message === "string" && item.message ? item.message.replace(/\bOpenClaw\b/g, PUBLIC_AGENT_NAME) : `${PUBLIC_AGENT_NAME} updated.`,
      data: item.data,
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

function mediaFallbackForIntent(intent: AgentIntent): "image" | "video" {
  return intent === "text-to-video" || intent === "image-to-video" ? "video" : "image"
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

  if (existing?.status === WorkspaceStatus.READY && existing.workspaceId) {
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
  const body = await parseOpenClawResponse(response)
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : typeof body.id === "string" ? body.id : ""

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

  return workspaceId
}

async function pollApimartTask(taskId: string, apiKey: string) {
  const started = Date.now()
  let latest: unknown = null

  while (Date.now() - started < config.mediaPollTimeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, config.mediaPollIntervalMs))

    const response = await fetch(`https://api.apimart.ai/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    latest = await parseProviderResponse(response)
    const data = latest && typeof latest === "object" ? (latest as { data?: { status?: string } }).data : undefined
    const status = data?.status

    if (status === "completed" || status === "failed") {
      return latest
    }
  }

  return latest
}

async function pollEggTask(taskId: string, apiKey: string) {
  const endpoints = [
    `https://api.eggapi.ai/v1/tasks/${taskId}`,
    `https://api.eggapi.ai/v1/generate/${taskId}`,
  ]
  const started = Date.now()
  let latest: unknown = null

  while (Date.now() - started < config.mediaPollTimeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, config.mediaPollIntervalMs))

    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (response.status === 404 || response.status === 405) {
        continue
      }

      latest = await parseProviderResponse(response)
      const urls = extractUrls(latest)
      const text = JSON.stringify(latest).toLowerCase()

      if (urls.length > 0 || text.includes("completed") || text.includes("failed") || text.includes("succeeded")) {
        return latest
      }
    }
  }

  return latest
}

export async function callOpenRouter(
  message: string,
  history: ClientMessage[] = [],
  attachments: ClientAttachment[] = [],
): Promise<ProviderResult> {
  const apiKey = requireConfig(config.openRouterApiKey, `${PUBLIC_AGENT_NAME} is missing OPENROUTER_API_KEY.`)
  const imageParts = attachments
    .filter((attachment) => attachment.type.startsWith("image/") && attachmentUrl(attachment))
    .slice(0, 4)
    .map((attachment) => ({
      type: "image_url" as const,
      image_url: {
        url: attachmentUrl(attachment),
        detail: "auto",
      },
    }))

  const userContent = imageParts.length > 0 ? [{ type: "text" as const, text: message }, ...imageParts] : message

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai",
      "X-OpenRouter-Title": "Gemini Spark",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are Gemini Spark, a multimodal agent coordinator. Answer clearly, explain the selected path, and when useful turn the chat into briefs, workflows, prompts, or handoff notes. Do not reveal hidden reasoning.",
        },
        ...compactHistory(history),
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  })

  const body = (await parseProviderResponse(response)) as {
    choices?: Array<{ message?: { content?: string } }>
    model?: string
    usage?: unknown
  }

  return {
    intent: "text",
    provider: PUBLIC_AGENT_NAME,
    model: typeof body.model === "string" ? body.model : OPENROUTER_MODEL,
    message: body.choices?.[0]?.message?.content || `${PUBLIC_AGENT_NAME} returned an empty response.`,
    usage: body.usage,
  }
}

export async function callOpenClawRun(
  intent: AgentIntent,
  message: string,
  history: ClientMessage[] = [],
  attachments: ClientAttachment[] = [],
  context: ProviderContext = {},
): Promise<ProviderResult> {
  if (!context.userId || !context.taskId) {
    if (intent === "image") {
      return callApimartImage(message, attachments)
    }

    if (intent === "text-to-video" || intent === "image-to-video") {
      return callEggVideo(intent, message, attachments)
    }

    return callOpenRouter(message, history, attachments)
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
      model: config.openClawDefaultModel,
    }),
  })
  const submitted = await parseOpenClawResponse(response)
  const emittedEvents = new Set<string>()
  await emitOpenClawEvents(openClawEvents(submitted.events), emittedEvents, context.onEvent)
  const runId = typeof submitted.runId === "string" ? submitted.runId : typeof submitted.id === "string" ? submitted.id : ""

  if (!runId) {
    throw new Error("OpenClaw Gateway did not return a run id.")
  }

  const started = Date.now()
  let latest: Record<string, unknown> = submitted

  while (Date.now() - started < config.openClawPollTimeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, config.openClawPollIntervalMs))

    const poll = await fetch(`${gatewayUrl}/runs/${encodeURIComponent(runId)}`, {
      headers: openClawHeaders(),
    })
    latest = await parseOpenClawResponse(poll)
    await emitOpenClawEvents(openClawEvents(latest.events), emittedEvents, context.onEvent)
    const status = openClawStatus(latest.status)

    if (status === "succeeded" || status === "done" || status === "complete" || status === "completed") {
      const artifacts = openClawArtifacts(latest.artifacts)
      const mediaUrls = artifacts
        .map((artifact) => artifact.url)
        .filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
      const finalIntent =
        latest.intent === "image" ||
        latest.intent === "text-to-video" ||
        latest.intent === "image-to-video" ||
        latest.intent === "text"
          ? latest.intent
          : intent

      return {
        intent: finalIntent,
        provider: PUBLIC_AGENT_NAME,
        model: typeof latest.model === "string" ? latest.model : config.openClawDefaultModel,
        workspaceId,
        taskId: runId,
        message:
          (typeof latest.message === "string" && latest.message) ||
          artifacts.find((artifact) => typeof artifact.text === "string")?.text ||
          `${PUBLIC_AGENT_NAME} completed the task.`,
        media:
          mediaUrls.length > 0
            ? { type: mediaKindFromUrls(mediaUrls, mediaFallbackForIntent(finalIntent)), urls: mediaUrls }
            : undefined,
        raw: latest,
      }
    }

    if (status === "failed" || status === "error" || status === "canceled" || status === "cancelled") {
      throw new Error((typeof latest.error === "string" && latest.error.replace(/\bOpenClaw\b/g, PUBLIC_AGENT_NAME)) || `${PUBLIC_AGENT_NAME} task failed.`)
    }
  }

  throw new Error(`${PUBLIC_AGENT_NAME} task timed out.`)
}

export async function callApimartImage(message: string, attachments: ClientAttachment[] = []): Promise<ProviderResult> {
  const apiKey = requireConfig(config.apimartApiKey, `${PUBLIC_AGENT_NAME} is missing APIMART_API_KEY.`)
  const imageUrls = attachments
    .filter((attachment) => attachment.type.startsWith("image/") && attachmentUrl(attachment))
    .slice(0, 8)
    .map(attachmentUrl)

  const response = await fetch("https://api.apimart.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: APIMART_IMAGE_MODEL,
      prompt: message,
      n: 1,
      size: "auto",
      resolution: "1k",
      ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
    }),
  })

  const submitted = await parseProviderResponse(response)
  const taskId = findTaskId(submitted)
  const finalBody = taskId ? await pollApimartTask(taskId, apiKey) : submitted
  const urls = extractUrls(finalBody)

  return {
    intent: "image",
    provider: PUBLIC_AGENT_NAME,
    model: PUBLIC_AGENT_NAME,
    taskId,
    media: urls.length > 0 ? { type: mediaKindFromUrls(urls, "image"), urls } : undefined,
    message:
      urls.length > 0
        ? `Generated an image with ${PUBLIC_AGENT_NAME}.`
        : taskId
          ? `Image generation is still processing. Task ID: ${taskId}.`
          : "Image generation was submitted, but no media URL was returned yet.",
    raw: urls.length > 0 ? undefined : finalBody,
  }
}

export async function callEggVideo(
  intent: "text-to-video" | "image-to-video",
  message: string,
  attachments: ClientAttachment[] = [],
): Promise<ProviderResult> {
  const apiKey = requireConfig(config.eggApiApiKey, `${PUBLIC_AGENT_NAME} is missing EGGAPI_API_KEY.`)
  const imageUrls = attachments
    .filter((attachment) => attachment.type.startsWith("image/") && attachmentUrl(attachment))
    .slice(0, 1)
    .map(attachmentUrl)
  const model = intent === "image-to-video" ? EGG_IMAGE_TO_VIDEO_MODEL : EGG_TEXT_TO_VIDEO_MODEL

  const response = await fetch("https://api.eggapi.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: message,
      negative_prompt: "blurry, low quality, watermark, text, distortion, extra limbs",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      parameters: {
        generate_audio: true,
        enable_web_search: false,
      },
      ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
    }),
  })

  const submitted = await parseProviderResponse(response)
  const taskId = findTaskId(submitted)
  const finalBody = taskId ? await pollEggTask(taskId, apiKey) : submitted
  const urls = extractUrls(finalBody || submitted)

  return {
    intent,
    provider: PUBLIC_AGENT_NAME,
    model: PUBLIC_AGENT_NAME,
    taskId,
    media: urls.length > 0 ? { type: mediaKindFromUrls(urls, "video"), urls } : undefined,
    message:
      urls.length > 0
        ? `Generated a video with ${PUBLIC_AGENT_NAME}.`
        : taskId
          ? `Video generation is still processing. Task ID: ${taskId}.`
          : "Video generation was submitted, but no media URL was returned yet.",
    raw: urls.length > 0 ? undefined : finalBody || submitted,
  }
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
