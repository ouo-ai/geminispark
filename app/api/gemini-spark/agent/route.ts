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
}

type AgentIntent = "text" | "image" | "text-to-video" | "image-to-video"

const OPENROUTER_MODEL = "moonshotai/kimi-k2.6"
const APIMART_IMAGE_MODEL = "gpt-image-2"
const EGG_TEXT_TO_VIDEO_MODEL = "alibaba/wan-2.7/text-to-video"
const EGG_IMAGE_TO_VIDEO_MODEL = "alibaba/wan-2.7/image-to-video"
const PUBLIC_AGENT_NAME = "Gemini Spark"

const generationWords = [
  "generate",
  "create",
  "make",
  "draw",
  "design",
  "render",
  "poster",
  "logo",
  "image",
  "picture",
  "photo",
  "illustration",
  "visual",
  "生成",
  "画",
  "图片",
  "海报",
  "照片",
  "插画",
]

const videoWords = [
  "video",
  "clip",
  "movie",
  "reel",
  "short",
  "animate",
  "animation",
  "motion",
  "cinematic",
  "camera",
  "视频",
  "动画",
  "运镜",
  "短片",
]

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${PUBLIC_AGENT_NAME} is missing a server API key.`)
  }

  return value
}

function hasAnyWord(input: string, words: string[]) {
  const text = input.toLowerCase()
  return words.some((word) => text.includes(word))
}

function selectIntent(message: string, attachments: ClientAttachment[] = []): AgentIntent {
  const hasImage = attachments.some((attachment) => attachment.type.startsWith("image/"))
  const wantsVideo = hasAnyWord(message, videoWords)
  const wantsImage = hasAnyWord(message, generationWords)

  if (wantsVideo && hasImage) {
    return "image-to-video"
  }

  if (wantsVideo) {
    return "text-to-video"
  }

  if (wantsImage) {
    return "image"
  }

  return "text"
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

async function callOpenRouter(message: string, history: ClientMessage[], attachments: ClientAttachment[]) {
  const apiKey = requireEnv("OPENROUTER_API_KEY")
  const imageParts = attachments
    .filter((attachment) => attachment.type.startsWith("image/"))
    .slice(0, 4)
    .map((attachment) => ({
      type: "image_url" as const,
      image_url: {
        url: attachment.dataUrl,
        detail: "auto",
      },
    }))

  const userContent =
    imageParts.length > 0
      ? [{ type: "text" as const, text: message }, ...imageParts]
      : message

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
    intent: "text" as const,
    provider: PUBLIC_AGENT_NAME,
    model: PUBLIC_AGENT_NAME,
    message: body.choices?.[0]?.message?.content || `${PUBLIC_AGENT_NAME} returned an empty response.`,
    usage: body.usage,
  }
}

async function pollApimartTask(taskId: string, apiKey: string) {
  const started = Date.now()
  let latest: unknown = null

  while (Date.now() - started < 115_000) {
    await new Promise((resolve) => setTimeout(resolve, 5_000))

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

async function callApimartImage(message: string, attachments: ClientAttachment[]) {
  const apiKey = requireEnv("APIMART_API_KEY")
  const imageUrls = attachments
    .filter((attachment) => attachment.type.startsWith("image/"))
    .slice(0, 8)
    .map((attachment) => attachment.dataUrl)

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
    intent: "image" as const,
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

async function pollEggTask(taskId: string, apiKey: string) {
  const endpoints = [
    `https://api.eggapi.ai/v1/tasks/${taskId}`,
    `https://api.eggapi.ai/v1/generate/${taskId}`,
  ]
  const started = Date.now()
  let latest: unknown = null

  while (Date.now() - started < 105_000) {
    await new Promise((resolve) => setTimeout(resolve, 5_000))

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

async function callEggVideo(intent: "text-to-video" | "image-to-video", message: string, attachments: ClientAttachment[]) {
  const apiKey = requireEnv("EGGAPI_API_KEY")
  const imageUrls = attachments
    .filter((attachment) => attachment.type.startsWith("image/"))
    .slice(0, 1)
    .map((attachment) => attachment.dataUrl)
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AgentRequest
    const message = payload.message?.trim()

    if (!message) {
      return jsonError("Message is required.")
    }

    const attachments = payload.attachments || []
    const intent = selectIntent(message, attachments)

    if (intent === "image") {
      return NextResponse.json(await callApimartImage(message, attachments))
    }

    if (intent === "text-to-video" || intent === "image-to-video") {
      return NextResponse.json(await callEggVideo(intent, message, attachments))
    }

    return NextResponse.json(await callOpenRouter(message, payload.history || [], attachments))
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Agent request failed."
    const isConfigError = rawMessage.startsWith(`${PUBLIC_AGENT_NAME} is missing`)
    const status = isConfigError ? 500 : 502
    const message = isConfigError ? rawMessage : `${PUBLIC_AGENT_NAME} request failed. Please try again.`

    return jsonError(message, status)
  }
}
