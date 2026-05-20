import { ArtifactKind, Prisma, TaskStatus } from "@prisma/client"

import { prisma } from "@/lib/db"

const PUBLIC_AGENT_NAME = "Gemini Spark"
const MAX_RETURNED_ATTACHMENT_BYTES = 400_000

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

function statusLabel(status: TaskStatus) {
  if (status === TaskStatus.SUCCEEDED) {
    return "done" as const
  }

  if (status === TaskStatus.FAILED || status === TaskStatus.CANCELED) {
    return "error" as const
  }

  return "thinking" as const
}

function artifactMedia(artifacts: Array<{ kind: ArtifactKind; url: string | null }>) {
  const videoUrls = artifacts.filter((artifact) => artifact.kind === ArtifactKind.VIDEO && artifact.url).map((artifact) => artifact.url!)
  if (videoUrls.length > 0) {
    return { type: "video" as const, urls: videoUrls }
  }

  const imageUrls = artifacts.filter((artifact) => artifact.kind === ArtifactKind.IMAGE && artifact.url).map((artifact) => artifact.url!)
  if (imageUrls.length > 0) {
    return { type: "image" as const, urls: imageUrls }
  }

  return undefined
}

function persistedAttachments(input: Prisma.JsonValue) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const attachments = Array.isArray(value.attachments) ? value.attachments : []

  return attachments
    .filter((attachment): attachment is Record<string, unknown> => Boolean(attachment && typeof attachment === "object"))
    .map((attachment) => {
      const dataUrl = typeof attachment.dataUrl === "string" ? attachment.dataUrl : ""
      if (!dataUrl || dataUrl.length > MAX_RETURNED_ATTACHMENT_BYTES) {
        return null
      }

      return {
        id:
          typeof attachment.id === "string"
            ? attachment.id
            : `${typeof attachment.name === "string" ? attachment.name : "attachment"}-${dataUrl.length}`,
        name: typeof attachment.name === "string" ? attachment.name : "attachment",
        type: typeof attachment.type === "string" ? attachment.type : "application/octet-stream",
        dataUrl,
      }
    })
    .filter((attachment): attachment is { id: string; name: string; type: string; dataUrl: string } => attachment !== null)
}

export async function getThreadMessagesForUser(userId: string, threadId: string) {
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      userId,
      archivedAt: null,
      projectAgent: {
        archivedAt: null,
      },
    },
  })

  if (!thread) {
    return null
  }

  const tasks = await prisma.task.findMany({
    where: {
      externalUserId: userId,
      projectAgentId: thread.projectAgentId,
      chatThreadId: thread.id,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 80,
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

  return tasks.flatMap((task) => {
    const textArtifact = task.artifacts.find((artifact) => artifact.kind === ArtifactKind.TEXT && artifact.text)
    const result = task.result && typeof task.result === "object" && !Array.isArray(task.result) ? (task.result as Record<string, unknown>) : {}
    const latestEvent = task.events[task.events.length - 1]
    const assistantBody =
      (typeof result.message === "string" && result.message) ||
      textArtifact?.text ||
      task.error ||
      latestEvent?.message ||
      (task.status === TaskStatus.QUEUED ? "Task queued." : "Gemini Spark is processing this task.")

    return [
      {
        id: `${task.id}:user`,
        role: "user" as const,
        body: publicAgentText(task.message),
        attachments: persistedAttachments(task.input),
      },
      {
        id: `${task.id}:assistant`,
        taskId: task.id,
        role: "assistant" as const,
        body: publicAgentText(assistantBody),
        status: statusLabel(task.status),
        provider: task.provider ? PUBLIC_AGENT_NAME : undefined,
        model: task.model ? PUBLIC_AGENT_NAME : undefined,
        intent: task.intent.toLowerCase().replaceAll("_", "-"),
        workspaceId: task.workspaceId,
        events: task.events.map((event) => ({
          id: event.id,
          type: event.type,
          message: publicAgentText(event.message),
          data: publicJsonValue(event.data),
          createdAt: event.createdAt.toISOString(),
        })),
        media: artifactMedia(task.artifacts),
      },
    ]
  })
}
