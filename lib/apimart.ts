import { z } from "zod"

export const GEMINI_SPARK_MODEL_NAME = "Gemini Spark"

const APIMART_BASE_URL = "https://api.apimart.ai/v1"
const PROVIDER_VIDEO_MODEL = "sora-2"

export const videoGenerationSchema = z.object({
  prompt: z.string().trim().min(8, "Describe the video in at least 8 characters.").max(2000),
  duration: z.union([z.literal(4), z.literal(8), z.literal(12), z.literal(16), z.literal(20)]).default(8),
  resolution: z.literal("720p").default("720p"),
  aspectRatio: z.union([z.literal("16:9"), z.literal("9:16")]).default("16:9"),
  imageUrl: z
    .string()
    .trim()
    .url("Use a public image URL that starts with http:// or https://.")
    .optional()
    .or(z.literal("")),
})

type VideoGenerationInput = z.infer<typeof videoGenerationSchema>

type ApimartGenerateResponse = {
  code?: number
  data?: Array<{
    status?: string
    task_id?: string
  }>
  message?: string
  error?: unknown
}

type ApimartTaskData = {
  id?: string
  status?: string
  progress?: number
  result?: unknown
  created?: number
  completed?: number
  estimated_time?: number
  actual_time?: number
  error?: {
    code?: number
    message?: string
    type?: string
  }
}

type ApimartTaskResponse = {
  code?: number
  data?: ApimartTaskData
  message?: string
  error?: unknown
}

export type GeminiSparkTask = {
  id: string
  status: string
  progress: number
  modelName: typeof GEMINI_SPARK_MODEL_NAME
  videoUrls: string[]
  thumbnailUrl?: string
  created?: number
  completed?: number
  estimatedTime?: number
  actualTime?: number
  errorMessage?: string
}

function getApimartApiKey() {
  return process.env.APIMART_API_KEY
}

function jsonHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }
}

async function parseProviderResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function providerErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    if (typeof record.message === "string") {
      return record.message
    }
    if (typeof record.error === "string") {
      return record.error
    }
    if (record.error && typeof record.error === "object" && "message" in record.error) {
      const message = (record.error as { message?: unknown }).message
      if (typeof message === "string") {
        return message
      }
    }
  }

  return fallback
}

function collectUrls(value: unknown): string[] {
  if (!value) {
    return []
  }

  if (typeof value === "string") {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUrls(item))
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>

    return [
      ...collectUrls(record.url),
      ...collectUrls(record.urls),
      ...collectUrls(record.video_url),
      ...collectUrls(record.videoUrl),
      ...collectUrls(record.file_url),
      ...collectUrls(record.fileUrl),
    ]
  }

  return []
}

function extractVideoUrls(result: unknown) {
  if (!result || typeof result !== "object") {
    return []
  }

  const record = result as Record<string, unknown>
  const urls = [
    ...collectUrls(record.videos),
    ...collectUrls(record.video),
    ...collectUrls(record.video_url),
    ...collectUrls(record.videoUrl),
    ...collectUrls(record.output),
  ]

  return Array.from(new Set(urls.filter((url) => /^https?:\/\//.test(url))))
}

function extractThumbnailUrl(result: unknown) {
  if (!result || typeof result !== "object") {
    return undefined
  }

  const record = result as Record<string, unknown>
  const [thumbnailUrl] = collectUrls(record.thumbnail_url)

  return thumbnailUrl
}

function normalizeTask(data: ApimartTaskData, fallbackId: string): GeminiSparkTask {
  return {
    id: data.id || fallbackId,
    status: data.status || "processing",
    progress: typeof data.progress === "number" ? data.progress : 0,
    modelName: GEMINI_SPARK_MODEL_NAME,
    videoUrls: extractVideoUrls(data.result),
    thumbnailUrl: extractThumbnailUrl(data.result),
    created: data.created,
    completed: data.completed,
    estimatedTime: data.estimated_time,
    actualTime: data.actual_time,
    errorMessage: data.error?.message,
  }
}

export async function createVideoGenerationTask(input: VideoGenerationInput) {
  const apiKey = getApimartApiKey()

  if (!apiKey) {
    return {
      ok: false as const,
      status: 503,
      message: "Video generation is not configured yet.",
    }
  }

  const body: Record<string, unknown> = {
    model: PROVIDER_VIDEO_MODEL,
    prompt: input.prompt,
    duration: input.duration,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
  }

  if (input.imageUrl) {
    body.image_urls = [input.imageUrl]
  }

  const response = await fetch(`${APIMART_BASE_URL}/videos/generations`, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify(body),
  })
  const payload = (await parseProviderResponse(response)) as ApimartGenerateResponse

  if (!response.ok || payload.code !== 200) {
    return {
      ok: false as const,
      status: response.status || 502,
      message: providerErrorMessage(payload, "Gemini Spark could not start the video task."),
    }
  }

  const task = payload.data?.[0]

  if (!task?.task_id) {
    return {
      ok: false as const,
      status: 502,
      message: "Gemini Spark received an unexpected task response.",
    }
  }

  return {
    ok: true as const,
    task: {
      id: task.task_id,
      status: task.status || "submitted",
      progress: 0,
      modelName: GEMINI_SPARK_MODEL_NAME,
      videoUrls: [],
    } satisfies GeminiSparkTask,
  }
}

export async function getVideoGenerationTask(taskId: string) {
  const apiKey = getApimartApiKey()

  if (!apiKey) {
    return {
      ok: false as const,
      status: 503,
      message: "Video generation is not configured yet.",
    }
  }

  const response = await fetch(`${APIMART_BASE_URL}/tasks/${encodeURIComponent(taskId)}?language=en`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  })
  const payload = (await parseProviderResponse(response)) as ApimartTaskResponse

  if (!response.ok || payload.code !== 200 || !payload.data) {
    return {
      ok: false as const,
      status: response.status || 502,
      message: providerErrorMessage(payload, "Gemini Spark could not read the task status."),
    }
  }

  return {
    ok: true as const,
    task: normalizeTask(payload.data, taskId),
  }
}
