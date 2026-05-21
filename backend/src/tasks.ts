import { ArtifactKind, Prisma, Task, TaskIntent, TaskStatus } from "@prisma/client"

import { creditCostForIntent, debitTaskCreditsTx, refundTaskCredits } from "./billing.js"
import { prisma } from "./db.js"
import { fromDbIntent, selectIntent, toDbIntent } from "./intent.js"
import { getTaskQueue } from "./queue.js"
import { fetchOpenClawRunSnapshot, runProviderForIntent } from "./providers.js"
import { recordTaskConversationMetadata, validateTaskScope } from "./projects.js"
import type { AgentIntent, ClientAttachment, ClientMessage, ProviderEvent, ProviderResult, RuntimeRunSnapshot, TaskInput } from "./types.js"

const TERMINAL_STATUSES = new Set<TaskStatus>([TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELED])
const PUBLIC_AGENT_NAME = "Gemini Spark"
const BACKEND_SYNC_FAILURE_LIMIT = 6
const BACKEND_SYNC_FAILURE_MIN_AGE_MS = 10 * 60 * 1000

export type CreateTaskParams = {
  message: string
  attachments?: ClientAttachment[]
  history?: ClientMessage[]
  sessionId?: string
  clientTaskId?: string
  externalUserId?: string
  projectAgentId: string
  chatThreadId: string
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function statusLabel(status: TaskStatus) {
  return status.toLowerCase() as "queued" | "running" | "succeeded" | "failed" | "canceled"
}

function publicAgentText(value: string) {
  return value
    .replace(/\bOpenClaw\b/g, PUBLIC_AGENT_NAME)
    .replace(/anthropic\/claude[\w./-]*/gi, PUBLIC_AGENT_NAME)
    .replace(/\bclaude[\w./-]*4\.7[\w./-]*\b/gi, PUBLIC_AGENT_NAME)
    .replace(/\bclaude[\w./-]*opus[\w./-]*\b/gi, PUBLIC_AGENT_NAME)
    .replace(/\bClaude\s+(?:Opus\s+)?4\.7(?:\s+Opus)?\b/gi, PUBLIC_AGENT_NAME)
}

function publicJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    return publicAgentText(value)
  }

  if (Array.isArray(value)) {
    return value.map(publicJsonValue)
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      key === "model" && typeof entry === "string" ? PUBLIC_AGENT_NAME : publicJsonValue(entry),
    ]),
  )
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
  const message = publicAgentText(typeof result.message === "string" ? result.message : textArtifact?.text || task.error || "")

  return {
    id: task.id,
    clientTaskId: task.clientTaskId,
    sessionId: task.sessionId,
    projectAgentId: task.projectAgentId,
    chatThreadId: task.chatThreadId,
    intent: fromDbIntent(task.intent),
    status: statusLabel(task.status),
    progress: task.progress,
    provider: task.provider,
    model: task.model ? PUBLIC_AGENT_NAME : null,
    creditCost: task.creditCost,
    workspaceId: task.workspaceId,
    runtimeRunId: task.runtimeRunId,
    runtimeSessionId: task.runtimeSessionId,
    lastRuntimeEventAt: task.lastRuntimeEventAt?.toISOString() || null,
    message,
    error: task.error ? publicAgentText(task.error) : task.error,
    media: inferMediaFromArtifacts(task.artifacts),
    artifacts: task.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind.toLowerCase(),
      url: artifact.url,
      text: artifact.text ? publicAgentText(artifact.text) : artifact.text,
      metadata: publicJsonValue(artifact.metadata),
      createdAt: artifact.createdAt.toISOString(),
    })),
    events: task.events.map((event) => ({
      id: event.id,
      type: event.type,
      message: publicAgentText(event.message),
      data: publicJsonValue(event.data),
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

function progressFromProviderEvent(event: ProviderEvent) {
  const data = event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : {}
  const progress = data.progress
  return typeof progress === "number" && Number.isFinite(progress)
    ? Math.max(10, Math.min(95, Math.round(progress)))
    : undefined
}

async function appendProviderEvent(taskId: string, event: ProviderEvent) {
  if (event.id) {
    const existing = await prisma.taskEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    const alreadyRecorded = existing.some((row) => {
      const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {}
      return data.providerEventId === event.id
    })
    if (alreadyRecorded) {
      return
    }
  }

  const progress = progressFromProviderEvent(event)
  await appendTaskEvent(taskId, event.type, event.message, {
    source: "openclaw",
    providerEventId: event.id,
    providerCreatedAt: event.createdAt,
    ...(event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : { value: event.data }),
  })

  if (progress !== undefined) {
    await prisma.task.update({
      where: { id: taskId },
      data: { progress },
    })
  }
}

async function appendProviderEvents(taskId: string, events: ProviderEvent[]) {
  if (events.length === 0) {
    return
  }

  const existing = await prisma.taskEvent.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    take: 300,
  })
  const recordedProviderEventIds = new Set(
    existing
      .map((row) => {
        const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {}
        return typeof data.providerEventId === "string" ? data.providerEventId : ""
      })
      .filter(Boolean),
  )
  const nextProviderEventIds = new Set<string>()
  const rows: Prisma.TaskEventCreateManyInput[] = []
  let progress: number | undefined

  for (const event of events) {
    if (event.id) {
      if (recordedProviderEventIds.has(event.id) || nextProviderEventIds.has(event.id)) {
        continue
      }
      nextProviderEventIds.add(event.id)
    }

    const eventProgress = progressFromProviderEvent(event)
    if (eventProgress !== undefined) {
      progress = progress === undefined ? eventProgress : Math.max(progress, eventProgress)
    }

    rows.push({
      taskId,
      type: event.type,
      message: event.message,
      data: toJson({
        source: "openclaw",
        providerEventId: event.id,
        providerCreatedAt: event.createdAt,
        ...(event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : { value: event.data }),
      }),
    })
  }

  if (rows.length > 0) {
    await prisma.taskEvent.createMany({ data: rows })
  }

  if (progress !== undefined) {
    await prisma.task.update({
      where: { id: taskId },
      data: { progress },
    })
  }
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
    projectAgentId: params.projectAgentId,
    chatThreadId: params.chatThreadId,
  }
  const intent = selectIntent(message, input.attachments)
  const dbIntent = toDbIntent(intent)
  const creditCost = creditCostForIntent(dbIntent)

  if (params.externalUserId) {
    await validateTaskScope(params.externalUserId, params.projectAgentId, params.chatThreadId)
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        clientTaskId: params.clientTaskId,
        externalUserId: params.externalUserId,
        sessionId: params.sessionId,
        projectAgentId: params.projectAgentId,
        chatThreadId: params.chatThreadId,
        message,
        intent: dbIntent,
        creditCost,
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

    if (params.externalUserId) {
      const creditBucket = await debitTaskCreditsTx(tx, {
        userId: params.externalUserId,
        taskId: created.id,
        cost: creditCost,
        intent: dbIntent,
      })

      await tx.task.update({
        where: { id: created.id },
        data: {
          creditBucket,
        },
      })
    }

    return created
  })

  if (params.externalUserId) {
    await recordTaskConversationMetadata({
      userId: params.externalUserId,
      projectAgentId: params.projectAgentId,
      chatThreadId: params.chatThreadId,
      message,
    })
  }

  try {
    await getTaskQueue().add("run-agent-task", { taskId: task.id }, { jobId: task.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue task."
    await refundTaskCredits(task.id, "Task was not queued; credits refunded.")
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
        workspaceId: result.workspaceId,
        runtimeRunId: result.runtimeRunId || result.taskId,
        runtimeSessionId: result.runtimeSessionId,
        lastRuntimeEventAt: new Date(),
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

async function storeOpenClawAcceptedResult(taskId: string, result: ProviderResult) {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.RUNNING,
      progress: 20,
      provider: result.provider,
      model: result.model,
      workspaceId: result.workspaceId,
      runtimeRunId: result.runtimeRunId || result.taskId,
      runtimeSessionId: result.runtimeSessionId,
      lastRuntimeEventAt: new Date(),
      result: toJson(result),
      error: null,
    },
  })
  await appendTaskEvent(taskId, "accepted", result.message, {
    runtimeRunId: result.runtimeRunId || result.taskId,
    runtimeSessionId: result.runtimeSessionId,
    workspaceId: result.workspaceId,
  })
}

async function storeOpenClawTerminalError(taskId: string, snapshot: RuntimeRunSnapshot) {
  const status = snapshot.status === "canceled" ? TaskStatus.CANCELED : TaskStatus.FAILED
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      progress: 100,
      provider: snapshot.provider,
      model: snapshot.model,
      workspaceId: snapshot.workspaceId,
      runtimeRunId: snapshot.runtimeRunId || snapshot.taskId,
      runtimeSessionId: snapshot.runtimeSessionId,
      lastRuntimeEventAt: new Date(),
      result: toJson(snapshot),
      error: snapshot.error || snapshot.message,
      finishedAt: new Date(),
    },
  })
  await appendTaskEvent(taskId, status === TaskStatus.CANCELED ? "canceled" : "failed", snapshot.error || snapshot.message)
}

async function loadThreadHistoryForTask(task: Task): Promise<ClientMessage[]> {
  if (!task.externalUserId || !task.projectAgentId || !task.chatThreadId) {
    return []
  }

  const previousTasks = await prisma.task.findMany({
    where: {
      id: {
        not: task.id,
      },
      externalUserId: task.externalUserId,
      projectAgentId: task.projectAgentId,
      chatThreadId: task.chatThreadId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 4,
    include: {
      artifacts: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  return previousTasks
    .reverse()
    .flatMap((item) => {
      const result = item.result && typeof item.result === "object" ? (item.result as Record<string, unknown>) : {}
      const textArtifact = item.artifacts.find((artifact) => artifact.kind === ArtifactKind.TEXT && artifact.text)
      const assistantBody =
        (typeof result.message === "string" && result.message) ||
        textArtifact?.text ||
        item.error ||
        ""
      const messages: ClientMessage[] = [{ role: "user", body: item.message }]

      if (assistantBody) {
        messages.push({ role: "assistant", body: publicAgentText(assistantBody) })
      }

      return messages
    })
    .slice(-8)
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
    const threadHistory = await loadThreadHistoryForTask(task)
    const result = await runProviderForIntent(intent, input.message, threadHistory, input.attachments, {
      taskId,
      userId: task.externalUserId || undefined,
      projectAgentId: task.projectAgentId || undefined,
      chatThreadId: task.chatThreadId || undefined,
      onEvent: (event) => appendProviderEvent(taskId, event),
    })
    await storeOpenClawAcceptedResult(taskId, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task failed."
    await refundTaskCredits(taskId, "Gemini Spark runtime did not accept the task; credits refunded.")

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

export async function syncOpenClawTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.status !== TaskStatus.RUNNING || !task.runtimeRunId) {
    return
  }

  const intent = fromDbIntent(task.intent)
  const snapshot = await fetchOpenClawRunSnapshot(task.runtimeRunId, intent)
  await appendProviderEvents(taskId, snapshot.events)

  await prisma.task.update({
    where: { id: taskId },
    data: {
      progress: snapshot.status === "running" || snapshot.status === "queued" ? Math.max(task.progress, 20) : 100,
      workspaceId: snapshot.workspaceId || task.workspaceId,
      runtimeRunId: snapshot.runtimeRunId || task.runtimeRunId,
      runtimeSessionId: snapshot.runtimeSessionId || task.runtimeSessionId,
      lastRuntimeEventAt: new Date(),
      result: toJson(snapshot),
    },
  })

  if (snapshot.workspaceId) {
    if (task.projectAgentId) {
      const runtimeAgentId =
        snapshot.raw && typeof snapshot.raw === "object" && "runtimeAgentId" in snapshot.raw
          ? String((snapshot.raw as { runtimeAgentId?: unknown }).runtimeAgentId || "")
          : ""
      await prisma.projectAgent
        .updateMany({
          where: {
            id: task.projectAgentId,
            workspaceId: snapshot.workspaceId,
          },
          data: {
            updatedAt: new Date(),
            ...(runtimeAgentId ? { runtimeAgentId } : {}),
          },
        })
        .catch(() => undefined)
    }
  }

  if (snapshot.status === "succeeded") {
    await storeProviderResult(taskId, snapshot)
  } else if (snapshot.status === "failed" || snapshot.status === "canceled") {
    await storeOpenClawTerminalError(taskId, snapshot)
  }
}

async function storeOpenClawSyncFailure(task: Task, error: unknown) {
  const message = error instanceof Error ? error.message : "Gemini Spark runtime sync failed."
  const previousFailures = await prisma.taskEvent.count({
    where: {
      taskId: task.id,
      type: "runtime_sync_failed",
    },
  })
  const nextFailureCount = previousFailures + 1
  const shouldFailTask =
    nextFailureCount >= BACKEND_SYNC_FAILURE_LIMIT &&
    Date.now() - task.createdAt.getTime() >= BACKEND_SYNC_FAILURE_MIN_AGE_MS

  await appendTaskEvent(task.id, "runtime_sync_failed", "Gemini Spark could not sync the runtime yet.", {
    source: "backend",
    error: publicAgentText(message),
    syncFailureCount: nextFailureCount,
  })

  await prisma.task.update({
    where: { id: task.id },
    data: {
      lastRuntimeEventAt: new Date(),
      ...(shouldFailTask
        ? {
            status: TaskStatus.FAILED,
            progress: 100,
            error: publicAgentText(message),
            finishedAt: new Date(),
          }
        : {}),
    },
  })

  if (shouldFailTask) {
    await appendTaskEvent(task.id, "failed", publicAgentText(message), {
      source: "backend",
      syncFailureCount: nextFailureCount,
    })
  }
}

async function runningTasksForSync(limit: number) {
  const normalizedLimit = Math.max(1, limit)
  const recentTake = Math.max(1, Math.floor(normalizedLimit / 2))
  const staleTake = Math.max(1, normalizedLimit - recentTake)
  const where = {
    status: TaskStatus.RUNNING,
    runtimeRunId: {
      not: null,
    },
  } satisfies Prisma.TaskWhereInput

  const [recent, stale] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      take: recentTake,
    }),
    prisma.task.findMany({
      where,
      orderBy: [
        {
          lastRuntimeEventAt: "asc",
        },
        {
          updatedAt: "asc",
        },
      ],
      take: staleTake,
    }),
  ])

  const deduped = new Map<string, Task>()
  for (const task of [...recent, ...stale]) {
    deduped.set(task.id, task)
  }

  return Array.from(deduped.values()).slice(0, normalizedLimit)
}

export async function syncRunningOpenClawTasks(limit = 25) {
  const tasks = await runningTasksForSync(limit)

  for (const task of tasks) {
    try {
      await syncOpenClawTask(task.id)
    } catch (error) {
      await storeOpenClawSyncFailure(task, error)
    }
  }

  return tasks.length
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
