import { Prisma, WorkspaceStatus } from "@prisma/client"

import { prisma } from "./db.js"

export class TaskScopeError extends Error {
  constructor(message = "Project or chat thread was not found.") {
    super(message)
    this.name = "TaskScopeError"
  }
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function titleFromMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "New chat"
  }
  return normalized.length > 54 ? `${normalized.slice(0, 51)}...` : normalized
}

function nicknameFromMessage(message: string) {
  if (/不要叫我|别叫我/.test(message)) {
    return null
  }

  const chinese = message.match(/(?:以后叫我|可以叫我|叫我|称呼我)\s*([^，。,.!！?？\s]{1,24})/)
  if (chinese?.[1]) {
    return chinese[1].trim()
  }

  const english = message.match(/\bcall me\s+([A-Za-z0-9_\-\u4e00-\u9fa5 ]{1,32})/i)
  if (english?.[1]) {
    return english[1].trim()
  }

  return null
}

export async function validateTaskScope(userId: string, projectAgentId: string, chatThreadId: string) {
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: chatThreadId,
      userId,
      projectAgentId,
      archivedAt: null,
      projectAgent: {
        archivedAt: null,
      },
    },
    include: {
      projectAgent: true,
    },
  })

  if (!thread) {
    throw new TaskScopeError()
  }

  return {
    project: thread.projectAgent,
    thread,
  }
}

export async function recordTaskConversationMetadata(params: {
  userId: string
  projectAgentId: string
  chatThreadId: string
  message: string
}) {
  const nickname = nicknameFromMessage(params.message)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.projectAgent.update({
      where: { id: params.projectAgentId },
      data: { updatedAt: now },
    })

    const thread = await tx.chatThread.findFirst({
      where: {
        id: params.chatThreadId,
        userId: params.userId,
        projectAgentId: params.projectAgentId,
      },
    })

    if (thread) {
      await tx.chatThread.update({
        where: { id: thread.id },
        data: {
          title: thread.title === "New chat" ? titleFromMessage(params.message) : undefined,
          updatedAt: now,
        },
      })
    }

    if (nickname) {
      await tx.userProfile.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          nickname,
          language: "zh-CN",
          preferences: toJson({}),
        },
        update: {
          nickname,
        },
      })
    }
  })
}

export async function projectContextForRun(userId: string, projectAgentId: string, chatThreadId: string) {
  const [profile, scope] = await Promise.all([
    prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        language: "zh-CN",
        preferences: toJson({}),
      },
      update: {},
    }),
    validateTaskScope(userId, projectAgentId, chatThreadId),
  ])

  return {
    profile: {
      nickname: profile.nickname,
      language: profile.language,
      preferences: profile.preferences,
      memorySummary: profile.memorySummary,
    },
    project: {
      id: scope.project.id,
      name: scope.project.name,
      description: scope.project.description,
      memorySummary: scope.project.memorySummary,
      instructions: scope.project.instructions,
      workspaceId: scope.project.workspaceId,
      runtimeAgentId: scope.project.runtimeAgentId,
    },
    thread: {
      id: scope.thread.id,
      title: scope.thread.title,
    },
  }
}

export async function markProjectWorkspaceReady(params: {
  userId: string
  projectAgentId: string
  workspaceId: string
  runtimeAgentId?: string
}) {
  return prisma.projectAgent.updateMany({
    where: {
      id: params.projectAgentId,
      userId: params.userId,
    },
    data: {
      workspaceId: params.workspaceId,
      runtimeAgentId: params.runtimeAgentId,
      status: WorkspaceStatus.READY,
    },
  })
}

export async function markProjectWorkspaceFailed(userId: string, projectAgentId: string) {
  return prisma.projectAgent.updateMany({
    where: {
      id: projectAgentId,
      userId,
    },
    data: {
      status: WorkspaceStatus.FAILED,
    },
  })
}
