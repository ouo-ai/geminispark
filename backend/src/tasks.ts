import { ArtifactKind, Prisma, TaskIntent, TaskStatus } from "@prisma/client"

import { prisma } from "./db.js"
import { fromDbIntent, selectIntent, toDbIntent } from "./intent.js"
import { getTaskQueue } from "./queue.js"
import { runProviderForIntent } from "./providers.js"
import type { AgentIntent, ClientAttachment, ClientMessage, ProviderResult, TaskInput } from "./types.js"

const TERMINAL_STATUSES = new Set<TaskStatus>([TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELED])

export type CreateTaskParams = {
  message: string
  attachments?: ClientAttachment[]
  history?: ClientMessage[]
  sessionId?: string
  clientTaskId?: string
  externalUserId?: string
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function statusLabel(status: TaskStatus) {
  return status.toLowerCase() as "queued" | "running" | "succeeded" | "failed" | "canceled"
}

function artifactKindForMedia(type: "image" | "video") {
  return type === "video" ? ArtifactKind.VIDEO : ArtifactKind.IMAGE
}

function inferMediaFromArtifacts(artifacts: Array<{ kind: ArtifactKind; url: string | null }>) {
  const videoUrls = artifacts.filter((artifact) => artifact.kind === ArtifactKind.VIDEO && artifact.url).map((artifact) => artifact.url!)
  if (videoUrls.length > 0) {
    return {
      type: "video" as const,
      urls: videoUrls,
    }
  }

  const imageUrls = artifacts.filter((artifact) => artifact.kind === ArtifactKind.IMAGE && artifact.url).map((artifact) => artifact.url!)
  if (imageUrls.length > 0) {
    return {
      type: "image" as const,
      urls: imageUrls,
    }
  }

  return undefined
}

export function serializeTask(
  task: Prisma.TaskGetPayload<{
    include: {
      artifacts: true
      events: true
    }
  }>,
) {
  const textArtifact = task.artifacts.find((artifact) => artifact.kind === ArtifactKind.TEXT && artifact.text)
  const result = task.result && typeof task.result === "object" ? (task.result as Record<string, unknown>) : {}
  const message = typeof result.message === "string" ? result.message : textArtifact?.text || task.error || ""

  return {
    id: task.id,
    clientTaskId: task.clientTaskId,
    sessionId: task.sessionId,
    intent: fromDbIntent(task.intent),
    status: statusLabel(task.status),
    progress: task.progress,
    provider: task.provider,
    model: task.model,
    message,
    error: task.error,
    media: inferMediaFromArtifacts(task.artifacts),
    artifacts: task.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind.toLowerCase(),
      url: artifact.url,
      text: artifact.text,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt.toISOString(),
    })),
    events: task.events.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      data: event.data,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    startedAt: task.startedAt?.toISOString() || null,
    finishedAt: task.finishedAt?.toISOString() || null,
  }
}

export async function getTask(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      artifacts: {
        orderBy: { createdAt: "asc" },
      },
      events: {
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  })
}

export async function getTaskForOwner(taskId: string, externalUserId: string) {
  return prisma.task.findFirst({
    where: {
      id: taskId,
      externalUserId,
    },
    include: {
      artifacts: {
        orderBy: { createdAt: "asc" },
      },
      events: {
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  })
}

export async function appendTaskEvent(taskId: string, type: string, message: string, data?: unknown) {
  return prisma.taskEvent.create({
    data: {
      taskId,
      type,
      message,
      data: data === undefined ? undefined : toJson(data),
    },
  })
}

export async function createTask(params: CreateTaskParams) {
  const message = params.message.trim()
  if (!message) {
    throw new Error("Message is required.")
  }

  const input: TaskInput = {
    message,
    attachments: params.attachments || [],
    history: params.history || [],
    sessionId: params.sessionId,
    clientTaskId: params.clientTaskId,
    externalUserId: params.externalUserId,
  }
  const intent = selectIntent(message, input.attachments)

  const task = await prisma.task.create({
    data: {
      clientTaskId: params.clientTaskId,
      externalUserId: params.externalUserId,
      sessionId: params.sessionId,
      message,
      intent: toDbIntent(intent),
      input: toJson(input),
      events: {
        create: {
          type: "queued",
          message: "Task queued.",
        },
      },
    },
    include: {
      artifacts: true,
      events: {
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  })

  try {
    await getTaskQueue().add("run-agent-task", { taskId: task.id }, { jobId: task.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue task."
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.FAILED,
        error: message,
        finishedAt: new Date(),
      },
    })
    await appendTaskEvent(task.id, "failed", message)
    throw error
  }

  return getTask(task.id)
}

export async function cancelTask(taskId: string, externalUserId?: string) {
  const task = externalUserId
    ? await prisma.task.findFirst({
        where: {
          id: taskId,
          externalUserId,
        },
      })
    : await prisma.task.findUnique({ where: { id: taskId } })

  if (!task) {
    return null
  }

  if (TERMINAL_STATUSES.has(task.status)) {
    return externalUserId ? getTaskForOwner(taskId, externalUserId) : getTask(taskId)
  }

  const job = await getTaskQueue().getJob(taskId)
  await job?.remove().catch(() => undefined)

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.CANCELED,
      progress: 100,
      finishedAt: new Date(),
    },
  })
  await appendTaskEvent(taskId, "canceled", "Task canceled.")

  return externalUserId ? getTaskForOwner(taskId, externalUserId) : getTask(taskId)
}

async function storeProviderResult(taskId: string, result: ProviderResult) {
  const artifactRows: Prisma.ArtifactCreateManyInput[] = []

  artifactRows.push({
    taskId,
    kind: ArtifactKind.TEXT,
    text: result.message,
    metadata: result.usage === undefined ? undefined : toJson({ usage: result.usage }),
  })

  if (result.media?.urls.length) {
    for (const url of result.media.urls) {
      artifactRows.push({
        taskId,
        kind: artifactKindForMedia(result.media.type),
        url,
        metadata: result.taskId ? toJson({ providerTaskId: result.taskId }) : undefined,
      })
    }
  }

  await prisma.$transaction([
    prisma.artifact.deleteMany({ where: { taskId } }),
    prisma.artifact.createMany({ data: artifactRows }),
    prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.SUCCEEDED,
        progress: 100,
        provider: result.provider,
        model: result.model,
        result: toJson(result),
        error: null,
        finishedAt: new Date(),
      },
    }),
    prisma.taskEvent.create({
      data: {
        taskId,
        type: "succeeded",
        message: "Task completed.",
        data: toJson({ intent: result.intent, taskId: result.taskId }),
      },
    }),
  ])
}

export async function processTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  if (TERMINAL_STATUSES.has(task.status)) {
    return
  }

  const input = task.input as unknown as TaskInput
  const intent = fromDbIntent(task.intent)

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.RUNNING,
      progress: 10,
      startedAt: task.startedAt || new Date(),
      error: null,
    },
  })
  await appendTaskEvent(taskId, "running", "Task started.", { intent })

  try {
    const result = await runProviderForIntent(intent, input.message, input.history, input.attachments)
    await storeProviderResult(taskId, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task failed."
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.FAILED,
        progress: 100,
        error: message,
        finishedAt: new Date(),
      },
    })
    await appendTaskEvent(taskId, "failed", message)
    throw error
  }
}

function toDbStatus(status: string) {
  const normalized = status.trim().toUpperCase()
  if (normalized === "QUEUED") return TaskStatus.QUEUED
  if (normalized === "RUNNING") return TaskStatus.RUNNING
  if (normalized === "SUCCEEDED" || normalized === "DONE" || normalized === "COMPLETE") return TaskStatus.SUCCEEDED
  if (normalized === "FAILED" || normalized === "ERROR") return TaskStatus.FAILED
  if (normalized === "CANCELED" || normalized === "CANCELLED") return TaskStatus.CANCELED
  throw new Error(`Unsupported task status: ${status}`)
}

export async function updateTaskFromMcp(params: {
  taskId: string
  status: string
  message?: string
  error?: string
  mediaUrls?: string[]
  mediaType?: "image" | "video"
  intent?: AgentIntent
}) {
  const status = toDbStatus(params.status)
  const finishedAt = TERMINAL_STATUSES.has(status) ? new Date() : undefined
  const result = {
    message: params.message,
    media: params.mediaUrls?.length
      ? {
          type: params.mediaType || "image",
          urls: params.mediaUrls,
        }
      : undefined,
  }

  const artifactRows: Prisma.ArtifactCreateManyInput[] = []
  if (params.message) {
    artifactRows.push({
      taskId: params.taskId,
      kind: ArtifactKind.TEXT,
      text: params.message,
    })
  }
  if (params.mediaUrls?.length) {
    for (const url of params.mediaUrls) {
      artifactRows.push({
        taskId: params.taskId,
        kind: artifactKindForMedia(params.mediaType || "image"),
        url,
      })
    }
  }

  await prisma.$transaction(async (tx) => {
    if (artifactRows.length > 0) {
      await tx.artifact.deleteMany({ where: { taskId: params.taskId } })
      await tx.artifact.createMany({ data: artifactRows })
    }

    await tx.task.update({
      where: { id: params.taskId },
      data: {
        status,
        progress: TERMINAL_STATUSES.has(status) ? 100 : status === TaskStatus.RUNNING ? 20 : 0,
        intent: params.intent ? toDbIntent(params.intent) : undefined,
        result: toJson(result),
        error: params.error || null,
        finishedAt,
      },
    })

    await tx.taskEvent.create({
      data: {
        taskId: params.taskId,
        type: statusLabel(status),
        message: params.message || params.error || `Task status updated to ${statusLabel(status)}.`,
        data: toJson({ source: "mcp" }),
      },
    })
  })

  return getTask(params.taskId)
}

export function isTerminalStatus(status: TaskStatus) {
  return TERMINAL_STATUSES.has(status)
}

export function dbIntentFromExternal(intent: AgentIntent): TaskIntent {
  return toDbIntent(intent)
}
