import type { FastifyInstance } from "fastify"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod/v4"

import { config } from "./config.js"
import { getTask, serializeTask, updateTaskFromMcp } from "./tasks.js"

function jsonText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

function createMcpServer() {
  const server = new McpServer({
    name: "geminispark",
    version: "0.1.0",
  })

  server.registerTool(
    "geminispark_get_task",
    {
      description: "Read a Gemini Spark task by ID.",
      inputSchema: {
        taskId: z.string().min(1),
      },
    },
    async ({ taskId }) => {
      const task = await getTask(taskId)
      if (!task) {
        return jsonText({ error: "Task not found." })
      }

      return jsonText(serializeTask(task))
    },
  )

  server.registerTool(
    "geminispark_update_task",
    {
      description: "Update Gemini Spark task status and optional outputs.",
      inputSchema: {
        taskId: z.string().min(1),
        status: z.enum(["queued", "running", "succeeded", "failed", "canceled", "done", "error"]),
        message: z.string().optional(),
        error: z.string().optional(),
        mediaUrls: z.array(z.string()).optional(),
        mediaType: z.enum(["image", "video"]).optional(),
        intent: z.enum(["text", "image", "text-to-video", "image-to-video"]).optional(),
      },
    },
    async (params) => {
      const task = await updateTaskFromMcp(params)
      if (!task) {
        return jsonText({ error: "Task not found." })
      }

      return jsonText(serializeTask(task))
    },
  )

  return server
}

function isAuthorized(authorizationHeader: string | undefined) {
  if (!config.mcpAuthToken) {
    return true
  }

  return authorizationHeader === `Bearer ${config.mcpAuthToken}`
}

export function registerMcpRoutes(app: FastifyInstance) {
  app.post("/mcp", async (request, reply) => {
    if (!isAuthorized(request.headers.authorization)) {
      return reply.code(401).send({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized.",
        },
        id: null,
      })
    }

    const server = createMcpServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })

    reply.hijack()

    try {
      await server.connect(transport)
      await transport.handleRequest(request.raw, reply.raw, request.body)
    } catch (error) {
      app.log.error({ error }, "MCP request failed")
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" })
      }
      reply.raw.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error.",
          },
          id: null,
        }),
      )
    } finally {
      await transport.close().catch(() => undefined)
      await server.close().catch(() => undefined)
    }
  })

  app.get("/mcp", async (_, reply) =>
    reply.code(405).send({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
  )
}
