import { Prisma, WorkspaceStatus } from "@prisma/client"

import { prisma } from "@/lib/db"

const DEFAULT_PROJECT_NAME = "General"
const DEFAULT_THREAD_TITLE = "New chat"

type ProjectRecord = Prisma.ProjectAgentGetPayload<Record<string, never>>
type ThreadRecord = Prisma.ChatThreadGetPayload<Record<string, never>>
type ProfileRecord = Prisma.UserProfileGetPayload<Record<string, never>>

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function defaultProjectInstructions() {
  return [
    "This is the user's default Gemini Spark project agent.",
    "Keep project-specific tasks, files, and decisions inside this project.",
    "Do not use transcript details from another project or chat thread.",
  ].join("\n")
}

function serializeProfile(profile: ProfileRecord) {
  return {
    nickname: profile.nickname,
    language: profile.language,
    preferences: profile.preferences,
    memorySummary: profile.memorySummary,
  }
}

function serializeProject(project: ProjectRecord) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status.toLowerCase(),
    workspaceId: project.workspaceId,
    runtimeAgentId: project.runtimeAgentId,
    memorySummary: project.memorySummary,
    instructions: project.instructions,
    archivedAt: project.archivedAt?.toISOString() || null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

function serializeThread(thread: ThreadRecord) {
  return {
    id: thread.id,
    projectAgentId: thread.projectAgentId,
    title: thread.title,
    archivedAt: thread.archivedAt?.toISOString() || null,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  }
}

export function workspaceStatusFromProject(project: ProjectRecord | null) {
  return {
    provider: "openclaw",
    status: project?.status.toLowerCase() || "missing",
    workspaceId: project?.workspaceId || null,
    runtimeAgentId: project?.runtimeAgentId || null,
    initializedAt: project?.workspaceId ? project.updatedAt.toISOString() : null,
    lastUsedAt: project?.updatedAt.toISOString() || null,
    lastSyncedAt: project?.updatedAt.toISOString() || null,
    error: null,
  }
}

export async function ensureUserProfile(userId: string) {
  return prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      language: "zh-CN",
      preferences: toJson({}),
    },
    update: {},
  })
}

export async function ensureDefaultProjectBundle(userId: string, requestedProjectId?: string | null, requestedThreadId?: string | null) {
  const [profile, initialProjects, requestedThread] = await Promise.all([
    ensureUserProfile(userId),
    prisma.projectAgent.findMany({
      where: {
        userId,
        archivedAt: null,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
    }),
    requestedThreadId
      ? prisma.chatThread.findFirst({
          where: {
            id: requestedThreadId,
            userId,
            archivedAt: null,
            projectAgent: {
              archivedAt: null,
            },
          },
          include: {
            projectAgent: true,
          },
        })
      : Promise.resolve(null),
  ])
  let projects = initialProjects

  if (projects.length === 0) {
    const created = await prisma.projectAgent.create({
      data: {
        userId,
        name: DEFAULT_PROJECT_NAME,
        description: "Default personal workspace.",
        instructions: defaultProjectInstructions(),
        status: WorkspaceStatus.PENDING,
      },
    })
    await prisma.chatThread.create({
      data: {
        userId,
        projectAgentId: created.id,
        title: DEFAULT_THREAD_TITLE,
      },
    })
    projects = [created]
  }

  if (requestedThread?.projectAgent && !projects.some((project) => project.id === requestedThread.projectAgentId)) {
    projects = [requestedThread.projectAgent, ...projects]
  }

  const activeProject =
    requestedThread?.projectAgent ||
    (requestedProjectId && projects.find((project) => project.id === requestedProjectId)) || projects[0]

  let threads = await prisma.chatThread.findMany({
    where: {
      userId,
      projectAgentId: activeProject.id,
      archivedAt: null,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
  })

  if (threads.length === 0) {
    const createdThread = await prisma.chatThread.create({
      data: {
        userId,
        projectAgentId: activeProject.id,
        title: DEFAULT_THREAD_TITLE,
      },
    })
    threads = [createdThread]
  }

  const activeThread =
    (requestedThreadId && threads.find((thread) => thread.id === requestedThreadId)) || threads[0]

  return {
    profile: serializeProfile(profile),
    projects: projects.map(serializeProject),
    activeProject: serializeProject(activeProject),
    threads: threads.map(serializeThread),
    activeThread: serializeThread(activeThread),
    workspace: workspaceStatusFromProject(activeProject),
  }
}

export async function createProjectAgent(userId: string, name?: string) {
  const normalizedName = (name || "").trim() || "Untitled project"
  const project = await prisma.projectAgent.create({
    data: {
      userId,
      name: normalizedName.slice(0, 80),
      status: WorkspaceStatus.PENDING,
      instructions: [
        `Project name: ${normalizedName.slice(0, 80)}`,
        "Keep all project work and memory scoped to this project agent.",
      ].join("\n"),
    },
  })
  const thread = await prisma.chatThread.create({
    data: {
      userId,
      projectAgentId: project.id,
      title: DEFAULT_THREAD_TITLE,
    },
  })

  return {
    project: serializeProject(project),
    thread: serializeThread(thread),
  }
}

export async function updateProjectAgent(userId: string, projectAgentId: string, data: { name?: string; archived?: boolean }) {
  const project = await prisma.projectAgent.findFirst({
    where: {
      id: projectAgentId,
      userId,
    },
  })

  if (!project) {
    return null
  }

  const nextName = data.name ? data.name.replace(/\s+/g, " ").trim().slice(0, 80) : undefined
  const archivedAt = data.archived ? new Date() : undefined

  const updated = await prisma.$transaction(async (tx) => {
    const nextProject = await tx.projectAgent.update({
      where: { id: project.id },
      data: {
        name: nextName,
        archivedAt,
      },
    })

    if (archivedAt) {
      await tx.chatThread.updateMany({
        where: {
          userId,
          projectAgentId: project.id,
          archivedAt: null,
        },
        data: { archivedAt },
      })
    }

    return nextProject
  })

  return serializeProject(updated)
}

export async function createChatThread(userId: string, projectAgentId: string, title?: string) {
  const project = await prisma.projectAgent.findFirst({
    where: {
      id: projectAgentId,
      userId,
      archivedAt: null,
    },
  })

  if (!project) {
    return null
  }

  const thread = await prisma.chatThread.create({
    data: {
      userId,
      projectAgentId,
      title: (title || DEFAULT_THREAD_TITLE).trim().slice(0, 80),
    },
  })

  await prisma.projectAgent.update({
    where: { id: project.id },
    data: { updatedAt: new Date() },
  })

  return serializeThread(thread)
}

export async function updateChatThread(userId: string, threadId: string, data: { title?: string; archived?: boolean }) {
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      userId,
    },
  })

  if (!thread) {
    return null
  }

  const updated = await prisma.chatThread.update({
    where: { id: thread.id },
    data: {
      title: data.title ? data.title.replace(/\s+/g, " ").trim().slice(0, 80) : undefined,
      archivedAt: data.archived ? new Date() : undefined,
      projectAgent: {
        update: {
          updatedAt: new Date(),
        },
      },
    },
  })

  return serializeThread(updated)
}
