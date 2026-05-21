import cors from "@fastify/cors"
import Fastify from "fastify"
import { z } from "zod"

import { PaymentRequiredError } from "./billing.js"
import { config } from "./config.js"
import { disconnectPrisma, prisma } from "./db.js"
import {
  GeminiOmniInputError,
  GeminiOmniRemoteError,
  getGeminiOmniHistory,
  refreshGeminiOmniTask,
  submitGeminiOmni,
} from "./gemini-omni.js"
import { registerMcpRoutes } from "./mcp.js"
import { ensureOpenClawWorkspace } from "./providers.js"
import { TaskScopeError } from "./projects.js"
import { closeTaskQueue } from "./queue.js"
import { cancelTask, createTask, getTaskForOwner, isTerminalStatus, serializeTask, syncOpenClawTask } from "./tasks.js"

const OWNER_HEADER = "x-geminispark-client-id"

const createTaskBodySchema = z.object({
  message: z.string().min(1),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        dataUrl: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["assistant", "user"]),
        body: z.string(),
      }),
    )
    .optional(),
  sessionId: z.string().optional(),
  clientTaskId: z.string().optional(),
  externalUserId: z.string().optional(),
  projectAgentId: z.string().min(1),
  chatThreadId: z.string().min(1),
})

const workspaceBodySchema = z
  .object({
    externalUserId: z.string().optional(),
    projectAgentId: z.string().min(1),
  })
  .optional()

const geminiOmniGenerateBodySchema = z.object({
  mode: z.enum(["video", "image", "image-edit"]).default("video"),
  prompt: z.string().min(1).max(5000),
  duration: z.enum(["4", "6", "8", "10"]).optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(),
  resolution: z.enum(["720p", "1080p", "4k"]).optional(),
  imageSize: z
    .enum(["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9", "auto"])
    .optional(),
  outputFormat: z.enum(["png", "jpeg"]).optional(),
  imageUrls: z.array(z.string()).max(10).optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
})

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return true
  }

  return config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin)
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeOwnerId(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200) {
    return undefined
  }

  return trimmed
}

function ownerFromRequest(request: { headers: Record<string, string | string[] | undefined>; query?: unknown }, fallback?: string) {
  const query = request.query && typeof request.query === "object" ? (request.query as Record<string, unknown>) : {}

  return (
    normalizeOwnerId(firstHeader(request.headers[OWNER_HEADER])) ||
    normalizeOwnerId(query.clientId) ||
    normalizeOwnerId(query.ownerId) ||
    normalizeOwnerId(fallback)
  )
}

function sendOwnerIdRequired(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
  return reply.code(401).send({ error: "Client owner id is required." })
}

export function buildServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 40 * 1024 * 1024,
  })

  app.register(cors, {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error("Origin not allowed."), false)
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Accept", "Authorization", "Content-Type", OWNER_HEADER],
  })

  app.get("/health", async () => ({
    ok: true,
    service: "geminispark-api",
    time: new Date().toISOString(),
  }))

  function requireAgentApiAuthorization(request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
    if (!config.agentApiToken) {
      return reply.code(500).send({ error: "AGENT_API_TOKEN is not configured." })
    }

    if (firstHeader(request.headers.authorization) !== `Bearer ${config.agentApiToken}`) {
      return reply.code(401).send({ error: "Unauthorized." })
    }

    return undefined
  }

  async function getFreshTaskForOwner(taskId: string, ownerId: string) {
    const task = await getTaskForOwner(taskId, ownerId)
    if (!task || isTerminalStatus(task.status) || !task.runtimeRunId) {
      return task
    }

    try {
      await syncOpenClawTask(task.id)
      return (await getTaskForOwner(taskId, ownerId)) || task
    } catch (error) {
      app.log.warn({ error, taskId }, "Failed to refresh running Gemini Spark task")
      return task
    }
  }

  app.post("/workspaces", async (request, reply) => {
    const unauthorized = requireAgentApiAuthorization(request, reply)
    if (unauthorized) {
      return unauthorized
    }

    const parsed = workspaceBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid workspace payload.",
        details: parsed.error.flatten(),
      })
    }

    const ownerId = ownerFromRequest(request, parsed.data?.externalUserId)
    if (!ownerId) {
      return sendOwnerIdRequired(reply)
    }

    try {
      const projectAgentId = parsed.data?.projectAgentId
      if (!projectAgentId) {
        return reply.code(400).send({ error: "projectAgentId is required." })
      }

      const workspaceId = await ensureOpenClawWorkspace(ownerId, projectAgentId)
      const project = await prisma.projectAgent.findFirst({
        where: {
          id: projectAgentId,
          userId: ownerId,
        },
      })
      return {
        provider: "openclaw",
        status: project?.status.toLowerCase() || "ready",
        projectAgentId,
        workspaceId: project?.workspaceId || workspaceId,
        runtimeAgentId: project?.runtimeAgentId || null,
        initializedAt: project?.workspaceId ? project.updatedAt.toISOString() : null,
        lastUsedAt: project?.updatedAt.toISOString() || null,
        lastSyncedAt: project?.updatedAt.toISOString() || null,
        error: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/\bOpenClaw\b/g, "Gemini Spark") : "Gemini Spark workspace initialization failed."
      return reply.code(502).send({
        provider: "openclaw",
        status: "failed",
        workspaceId: null,
        error: message,
      })
    }
  })

  app.post("/tasks", async (request, reply) => {
    const unauthorized = requireAgentApiAuthorization(request, reply)
    if (unauthorized) {
      return unauthorized
    }

    const parsed = createTaskBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid task payload.",
        details: parsed.error.flatten(),
      })
    }

    const ownerId = ownerFromRequest(request, parsed.data.externalUserId)
    if (!ownerId) {
      return sendOwnerIdRequired(reply)
    }

    let task
    try {
      task = await createTask({
        ...parsed.data,
        externalUserId: ownerId,
      })
    } catch (error) {
      if (error instanceof TaskScopeError) {
        return reply.code(403).send({ error: error.message })
      }

      if (error instanceof PaymentRequiredError) {
        return reply.code(402).send({
          error: error.message,
          code: "PAYMENT_REQUIRED",
          requiredCredits: error.details.requiredCredits,
          availableCredits: error.details.availableCredits,
        })
      }

      throw error
    }

    if (!task) {
      return reply.code(500).send({ error: "Task was created but could not be loaded." })
    }

    return reply.code(202).send(serializeTask(task))
  })

  app.get<{ Params: { taskId: string }; Querystring: { clientId?: string; ownerId?: string } }>(
    "/tasks/:taskId",
    async (request, reply) => {
      const unauthorized = requireAgentApiAuthorization(request, reply)
      if (unauthorized) {
        return unauthorized
      }

      const ownerId = ownerFromRequest(request)
      if (!ownerId) {
        return sendOwnerIdRequired(reply)
      }

      const task = await getFreshTaskForOwner(request.params.taskId, ownerId)
      if (!task) {
        return reply.code(404).send({ error: "Task not found." })
      }

      return serializeTask(task)
    },
  )

  app.post<{ Params: { taskId: string }; Querystring: { clientId?: string; ownerId?: string } }>(
    "/tasks/:taskId/cancel",
    async (request, reply) => {
      const unauthorized = requireAgentApiAuthorization(request, reply)
      if (unauthorized) {
        return unauthorized
      }

      const ownerId = ownerFromRequest(request)
      if (!ownerId) {
        return sendOwnerIdRequired(reply)
      }

      const task = await cancelTask(request.params.taskId, ownerId)
      if (!task) {
        return reply.code(404).send({ error: "Task not found." })
      }

      return serializeTask(task)
    },
  )

  app.get<{ Params: { taskId: string }; Querystring: { clientId?: string; ownerId?: string } }>(
    "/tasks/:taskId/events",
    async (request, reply) => {
      const unauthorized = requireAgentApiAuthorization(request, reply)
      if (unauthorized) {
        return unauthorized
      }

      const ownerId = ownerFromRequest(request)
      if (!ownerId) {
        return sendOwnerIdRequired(reply)
      }

      const initialTask = await getFreshTaskForOwner(request.params.taskId, ownerId)
      if (!initialTask) {
        return reply.code(404).send({ error: "Task not found." })
      }

      reply.hijack()
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      })

      let closed = false
      request.raw.on("close", () => {
        closed = true
      })

      const send = (event: string, data: unknown) => {
        if (closed) {
          return
        }

        reply.raw.write(`event: ${event}\n`)
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      send("task", serializeTask(initialTask))

      let syncInFlight = false
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval)
          return
        }

        try {
          if (!syncInFlight) {
            syncInFlight = true
            await syncOpenClawTask(request.params.taskId).catch((error) => {
              app.log.warn({ error, taskId: request.params.taskId }, "Failed to refresh streamed Gemini Spark task")
            })
            syncInFlight = false
          }

          const task = await getTaskForOwner(request.params.taskId, ownerId)
          if (!task) {
            send("error", { error: "Task not found." })
            clearInterval(interval)
            reply.raw.end()
            return
          }

          const serialized = serializeTask(task)
          send("task", serialized)

          if (isTerminalStatus(task.status)) {
            clearInterval(interval)
            reply.raw.end()
          }
        } catch (error) {
          syncInFlight = false
          app.log.error({ error }, "Failed to stream task event")
          send("error", { error: "Failed to stream task event." })
        }
      }, 2_000)
    },
  )

  app.post("/gemini-omni/generate", async (request, reply) => {
    const unauthorized = requireAgentApiAuthorization(request, reply)
    if (unauthorized) {
      return unauthorized
    }

    const parsed = geminiOmniGenerateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid generation request.",
        details: parsed.error.flatten(),
      })
    }

    const ownerId = ownerFromRequest(request)
    if (!ownerId) {
      return sendOwnerIdRequired(reply)
    }

    try {
      const { taskId } = await submitGeminiOmni({ ...parsed.data, userId: ownerId })
      const task = await refreshGeminiOmniTask(taskId, ownerId)
      return reply.code(202).send(task)
    } catch (error) {
      if (error instanceof PaymentRequiredError) {
        return reply.code(402).send({
          error: error.message,
          code: "PAYMENT_REQUIRED",
          requiredCredits: error.details.requiredCredits,
          availableCredits: error.details.availableCredits,
        })
      }
      if (error instanceof GeminiOmniInputError) {
        return reply.code(400).send({ error: error.message })
      }
      if (error instanceof GeminiOmniRemoteError) {
        return reply.code(502).send({ error: error.message })
      }
      const message = error instanceof Error ? error.message : "Failed to create generation task."
      app.log.error({ error: message }, "gemini-omni generate failed")
      return reply.code(500).send({ error: message })
    }
  })

  app.get("/gemini-omni/history", async (request, reply) => {
    const unauthorized = requireAgentApiAuthorization(request, reply)
    if (unauthorized) {
      return unauthorized
    }

    const ownerId = ownerFromRequest(request)
    if (!ownerId) {
      return sendOwnerIdRequired(reply)
    }

    const items = await getGeminiOmniHistory(ownerId, 20)
    return { items }
  })

  app.get<{ Params: { taskId: string } }>("/gemini-omni/:taskId", async (request, reply) => {
    const unauthorized = requireAgentApiAuthorization(request, reply)
    if (unauthorized) {
      return unauthorized
    }

    const ownerId = ownerFromRequest(request)
    if (!ownerId) {
      return sendOwnerIdRequired(reply)
    }

    const task = await refreshGeminiOmniTask(request.params.taskId, ownerId)
    if (!task) {
      return reply.code(404).send({ error: "Task not found." })
    }
    return task
  })

  registerMcpRoutes(app)

  return app
}

async function main() {
  const app = buildServer()

  const shutdown = async () => {
    app.log.info("Shutting down Gemini Spark API")
    await app.close()
    await closeTaskQueue()
    await disconnectPrisma()
  }

  process.once("SIGINT", () => void shutdown().then(() => process.exit(0)))
  process.once("SIGTERM", () => void shutdown().then(() => process.exit(0)))

  await app.listen({
    host: "0.0.0.0",
    port: config.port,
  })
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
