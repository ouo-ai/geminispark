# Gemini Spark Backend

This backend runs the long-lived Gemini Spark task layer outside Vercel.

## Services

- `pnpm backend:start`: Fastify API and MCP endpoint.
- `pnpm backend:worker`: BullMQ worker for text, image, and video tasks.
- `pnpm prisma:migrate:deploy`: apply Prisma migrations to Supabase Postgres.

## Required environment variables

- `DATABASE_URL`: Supabase shared pooler URL for runtime.
- `DIRECT_URL`: Supabase direct/shared pooler URL for Prisma migrations.
- `REDIS_URL`: Render Key Value internal connection string.
- `MCP_AUTH_TOKEN`: bearer token required by `/mcp`.
- `AGENT_API_TOKEN`: bearer token required by task API routes.
- `OPENCLAW_GATEWAY_URL`: VPS Gemini Spark adapter base URL.
- `OPENCLAW_GATEWAY_TOKEN`: bearer token for the VPS adapter.
- `OPENCLAW_SYNC_INTERVAL_MS`: worker polling interval for running OpenClaw tasks.
- `OPENCLAW_SYNC_BATCH_SIZE`: maximum running tasks to sync per worker tick.
- `ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the API.

Provider keys and model configuration live in the official OpenClaw Gateway
configuration on the VPS. Render should not call providers directly.

## API

- `GET /health`
- `POST /workspaces`
- `POST /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/events`
- `POST /tasks/:taskId/cancel`
- `POST /mcp`

Task create/read/cancel endpoints require `Authorization: Bearer AGENT_API_TOKEN`
plus a stable authenticated user id through the `x-geminispark-client-id` header.
Browser clients should call the Next.js proxy routes instead of calling Render
directly.

The frontend server expects `AGENT_API_URL` to point at the Render API URL.
