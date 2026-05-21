import { ArtifactKind, Prisma, TaskIntent, TaskStatus } from "@prisma/client"

import {
  creditCostForIntent,
  debitTaskCreditsTx,
  PaymentRequiredError,
  refundTaskCredits,
} from "./billing.js"
import { config, requireConfig } from "./config.js"
import { prisma } from "./db.js"
import { getTask, serializeTask } from "./tasks.js"

const PROVIDER = "kie.ai"

export type GeminiOmniMode = "video" | "image" | "image-edit"

const VIDEO_MODEL = "gemini-omni-video"
const IMAGE_MODEL = "google/nano-banana"
const IMAGE_EDIT_MODEL = "google/nano-banana-edit"

const VIDEO_DURATIONS = new Set(["4", "6", "8", "10"])
const VIDEO_ASPECT_RATIOS = new Set(["16:9", "9:16"])
const VIDEO_RESOLUTIONS = new Set(["720p", "1080p", "4k"])
const IMAGE_SIZES = new Set([
  "1:1",
  "9:16",
  "16:9",
  "3:4",
  "4:3",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
  "auto",
])
const OUTPUT_FORMATS = new Set(["png", "jpeg"])
const MAX_VIDEO_IMAGE_URLS = 7
const MAX_IMAGE_EDIT_URLS = 10
const TERMINAL_STATUSES = new Set<TaskStatus>([
  TaskStatus.SUCCEEDED,
  TaskStatus.FAILED,
  TaskStatus.CANCELED,
])

export type GeminiOmniSubmitParams = {
  userId: string
  mode: GeminiOmniMode
  prompt: string
  duration?: string
  aspectRatio?: string
  resolution?: string
  imageSize?: string
  outputFormat?: string
  imageUrls?: string[]
  seed?: number
}

class GeminiOmniInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeminiOmniInputError"
  }
}

class GeminiOmniRemoteError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message)
    this.name = "GeminiOmniRemoteError"
  }
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

type VideoInput = {
  mode: "video"
  prompt: string
  duration: string
  aspectRatio: string
  resolution: string
  imageUrls: string[]
  seed?: number
}

type ImageInput = {
  mode: "image" | "image-edit"
  prompt: string
  imageSize: string
  outputFormat: string
  imageUrls: string[]
}

type ValidatedInput = VideoInput | ImageInput

function validateImageUrls(urls: string[] | undefined, max: number, label: string) {
  const list = (urls || []).map((url) => url.trim()).filter(Boolean)
  if (list.length > max) {
    throw new GeminiOmniInputError(`At most ${max} ${label} are allowed.`)
  }
  for (const url of list) {
    if (!/^https:\/\/.+/i.test(url)) {
      throw new GeminiOmniInputError(`Each ${label} must be a public https:// URL (invalid: ${url}).`)
    }
  }
  return list
}

function validate(params: GeminiOmniSubmitParams): ValidatedInput {
  const prompt = (params.prompt || "").trim()
  if (!prompt) {
    throw new GeminiOmniInputError("Prompt is required.")
  }
  if (prompt.length > 5000) {
    throw new GeminiOmniInputError("Prompt is too long (max 5000 characters).")
  }

  if (params.mode === "video") {
    const duration = params.duration || "8"
    if (!VIDEO_DURATIONS.has(duration)) {
      throw new GeminiOmniInputError("Duration must be one of 4, 6, 8, or 10 seconds.")
    }
    const aspectRatio = params.aspectRatio || "16:9"
    if (!VIDEO_ASPECT_RATIOS.has(aspectRatio)) {
      throw new GeminiOmniInputError("Aspect ratio must be 16:9 or 9:16.")
    }
    const resolution = params.resolution || "1080p"
    if (!VIDEO_RESOLUTIONS.has(resolution)) {
      throw new GeminiOmniInputError("Resolution must be 720p, 1080p, or 4k.")
    }
    const imageUrls = validateImageUrls(params.imageUrls, MAX_VIDEO_IMAGE_URLS, "reference image")
    const seed =
      typeof params.seed === "number" &&
      Number.isFinite(params.seed) &&
      params.seed >= 0 &&
      params.seed <= 2_147_483_647
        ? Math.floor(params.seed)
        : undefined
    return { mode: "video", prompt, duration, aspectRatio, resolution, imageUrls, seed }
  }

  const imageSize = params.imageSize || "1:1"
  if (!IMAGE_SIZES.has(imageSize)) {
    throw new GeminiOmniInputError("Image size is not supported.")
  }
  const outputFormat = (params.outputFormat || "png").toLowerCase()
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    throw new GeminiOmniInputError("Output format must be png or jpeg.")
  }

  if (params.mode === "image-edit") {
    const imageUrls = validateImageUrls(params.imageUrls, MAX_IMAGE_EDIT_URLS, "source image")
    if (imageUrls.length === 0) {
      throw new GeminiOmniInputError("Image-to-image requires at least one source image URL.")
    }
    return { mode: "image-edit", prompt, imageSize, outputFormat, imageUrls }
  }

  return { mode: "image", prompt, imageSize, outputFormat, imageUrls: [] }
}

function readKieAiKey() {
  return requireConfig(config.kieAiApiKey, "KIE_AI_API_KEY is not configured.")
}

async function callKieAi(path: string, init: RequestInit & { method: "GET" | "POST" }) {
  const url = `${config.kieAiBaseUrl}${path}`
  const headers = {
    Authorization: `Bearer ${readKieAiKey()}`,
    Accept: "application/json",
    ...(init.method === "POST" ? { "Content-Type": "application/json" } : {}),
    ...init.headers,
  }
  const response = await fetch(url, { ...init, headers })
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  if (!response.ok) {
    throw new GeminiOmniRemoteError(
      `kie.ai request failed (${response.status}): ${text || response.statusText}`,
      response.status,
    )
  }

  return body as Record<string, unknown>
}

function readCode(body: Record<string, unknown>) {
  return typeof body.code === "number" ? body.code : Number(body.code) || 0
}

function readMsg(body: Record<string, unknown>) {
  return typeof body.msg === "string" ? body.msg : ""
}

function readData(body: Record<string, unknown>): Record<string, unknown> {
  const data = body.data
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {}
}

function modelForMode(mode: GeminiOmniMode) {
  if (mode === "image") return IMAGE_MODEL
  if (mode === "image-edit") return IMAGE_EDIT_MODEL
  return config.kieAiOmniModel || VIDEO_MODEL
}

function intentForInput(input: ValidatedInput): TaskIntent {
  if (input.mode === "video") {
    return input.imageUrls.length > 0 ? TaskIntent.IMAGE_TO_VIDEO : TaskIntent.TEXT_TO_VIDEO
  }
  return TaskIntent.IMAGE
}

function buildKieInputPayload(input: ValidatedInput) {
  if (input.mode === "video") {
    return {
      prompt: input.prompt,
      duration: input.duration,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      image_urls: input.imageUrls,
      ...(input.seed === undefined ? {} : { seed: input.seed }),
    }
  }

  return {
    prompt: input.prompt,
    image_size: input.imageSize,
    output_format: input.outputFormat,
    ...(input.imageUrls.length > 0 ? { image_urls: input.imageUrls } : {}),
  }
}

function artifactKindForMode(mode: GeminiOmniMode) {
  return mode === "video" ? ArtifactKind.VIDEO : ArtifactKind.IMAGE
}

function modeLabel(mode: GeminiOmniMode) {
  if (mode === "image") return "Nano Banana"
  if (mode === "image-edit") return "Nano Banana Edit"
  return "Gemini Omni"
}

export async function submitGeminiOmni(params: GeminiOmniSubmitParams): Promise<{ taskId: string }> {
  readKieAiKey()
  const validated = validate(params)
  const intent = intentForInput(validated)
  const creditCost = creditCostForIntent(intent)
  const kieInput = buildKieInputPayload(validated)
  const model = modelForMode(validated.mode)
  const label = modeLabel(validated.mode)

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        externalUserId: params.userId,
        message: validated.prompt,
        intent,
        creditCost,
        provider: PROVIDER,
        model,
        input: toJson({ mode: validated.mode, ...kieInput }),
        events: {
          create: {
            type: "queued",
            message: `${label} task queued.`,
          },
        },
      },
    })

    const bucket = await debitTaskCreditsTx(tx, {
      userId: params.userId,
      taskId: created.id,
      cost: creditCost,
      intent,
    })

    await tx.task.update({
      where: { id: created.id },
      data: { creditBucket: bucket },
    })

    return created
  })

  try {
    const submission = await callKieAi("/api/v1/jobs/createTask", {
      method: "POST",
      body: JSON.stringify({ model, input: kieInput }),
    })

    if (readCode(submission) !== 200) {
      throw new GeminiOmniRemoteError(readMsg(submission) || "kie.ai rejected the task.", readCode(submission))
    }

    const data = readData(submission)
    const kieTaskId = typeof data.taskId === "string" ? data.taskId : ""
    if (!kieTaskId) {
      throw new GeminiOmniRemoteError("kie.ai did not return a taskId.")
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.RUNNING,
        progress: 10,
        runtimeRunId: kieTaskId,
        lastRuntimeEventAt: new Date(),
        startedAt: new Date(),
      },
    })
    await prisma.taskEvent.create({
      data: {
        taskId: task.id,
        type: "accepted",
        message: `${label} accepted the task.`,
        data: toJson({ kieTaskId, model, mode: validated.mode }),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : `${label} submission failed.`
    await refundTaskCredits(task.id, `${label} task was not accepted; credits refunded.`)
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.FAILED,
        progress: 100,
        error: message,
        finishedAt: new Date(),
      },
    })
    await prisma.taskEvent.create({
      data: {
        taskId: task.id,
        type: "failed",
        message,
      },
    })
    throw error
  }

  return { taskId: task.id }
}

type KieState = "waiting" | "queuing" | "generating" | "success" | "fail"

function progressFromState(state: KieState, current: number) {
  if (state === "waiting" || state === "queuing") return Math.max(current, 15)
  if (state === "generating") return Math.max(current, 60)
  return 100
}

function parseResultUrls(value: unknown): string[] {
  if (typeof value !== "string" || !value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { resultUrls?: unknown }).resultUrls)) {
      return (parsed as { resultUrls: unknown[] }).resultUrls.filter(
        (entry): entry is string => typeof entry === "string" && /^https?:\/\//.test(entry),
      )
    }
  } catch {
    /* ignore */
  }
  return []
}

function modeFromTaskInput(taskInput: unknown): GeminiOmniMode {
  if (taskInput && typeof taskInput === "object") {
    const mode = (taskInput as { mode?: unknown }).mode
    if (mode === "image" || mode === "image-edit" || mode === "video") {
      return mode
    }
  }
  return "video"
}

async function recordKieEvent(taskId: string, state: KieState, label: string, snapshot: Record<string, unknown>) {
  const latest = await prisma.taskEvent.findFirst({
    where: { taskId },
    orderBy: { createdAt: "desc" },
  })
  const latestState =
    latest?.data && typeof latest.data === "object"
      ? (latest.data as Record<string, unknown>).kieState
      : undefined
  if (latestState === state) {
    return
  }

  const labels: Record<KieState, string> = {
    waiting: `${label} queued…`,
    queuing: `${label} queued…`,
    generating: `${label} generating…`,
    success: `${label} complete.`,
    fail: `${label} failed.`,
  }

  await prisma.taskEvent.create({
    data: {
      taskId,
      type: state === "success" ? "succeeded" : state === "fail" ? "failed" : "running",
      message: labels[state] || `${label} status: ${state}`,
      data: toJson({ kieState: state, snapshot }),
    },
  })
}

export async function refreshGeminiOmniTask(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, externalUserId: userId, provider: PROVIDER },
  })
  if (!task) {
    return null
  }

  const mode = modeFromTaskInput(task.input)
  const label = modeLabel(mode)
  const kind = artifactKindForMode(mode)

  if (TERMINAL_STATUSES.has(task.status) || !task.runtimeRunId) {
    const fresh = await getTask(taskId)
    return fresh ? serializeTask(fresh) : null
  }

  try {
    const detail = await callKieAi(
      `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(task.runtimeRunId)}`,
      { method: "GET" },
    )
    if (readCode(detail) !== 200) {
      throw new GeminiOmniRemoteError(readMsg(detail) || "Failed to query kie.ai task.", readCode(detail))
    }

    const data = readData(detail)
    const rawState = typeof data.state === "string" ? data.state.toLowerCase() : ""
    const state = (["waiting", "queuing", "generating", "success", "fail"].includes(rawState)
      ? rawState
      : "generating") as KieState
    const progress = progressFromState(state, task.progress)
    await recordKieEvent(taskId, state, label, data)

    if (state === "success") {
      const urls = parseResultUrls(data.resultJson)
      await prisma.$transaction(async (tx) => {
        await tx.artifact.deleteMany({ where: { taskId } })
        const rows: Prisma.ArtifactCreateManyInput[] = [
          {
            taskId,
            kind: ArtifactKind.TEXT,
            text: `${label} ${mode === "video" ? "video" : "image"} ready.`,
          },
        ]
        for (const url of urls) {
          rows.push({ taskId, kind, url })
        }
        await tx.artifact.createMany({ data: rows })
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.SUCCEEDED,
            progress: 100,
            result: toJson({ provider: PROVIDER, mode, urls, raw: data }),
            error: null,
            finishedAt: new Date(),
            lastRuntimeEventAt: new Date(),
          },
        })
      })
    } else if (state === "fail") {
      const failMsg = typeof data.failMsg === "string" && data.failMsg ? data.failMsg : `${label} failed.`
      await refundTaskCredits(taskId, `${label} task failed; credits refunded.`)
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          progress: 100,
          error: failMsg,
          result: toJson({ provider: PROVIDER, mode, raw: data }),
          finishedAt: new Date(),
          lastRuntimeEventAt: new Date(),
        },
      })
    } else {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          progress,
          lastRuntimeEventAt: new Date(),
        },
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query kie.ai task."
    await prisma.taskEvent.create({
      data: {
        taskId,
        type: "warning",
        message,
        data: toJson({ kieState: "poll_error" }),
      },
    })
  }

  const fresh = await getTask(taskId)
  return fresh ? serializeTask(fresh) : null
}

export async function getGeminiOmniHistory(userId: string, limit = 20) {
  const rows = await prisma.task.findMany({
    where: { externalUserId: userId, provider: PROVIDER },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      artifacts: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  })
  return rows.map(serializeTask)
}

export { GeminiOmniInputError, GeminiOmniRemoteError, PaymentRequiredError }
