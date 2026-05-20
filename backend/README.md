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
- `OPENROUTER_API_KEY`: text provider key.
- `APIMART_API_KEY`: image provider key.
- `EGGAPI_API_KEY`: video provider key.
- `MCP_AUTH_TOKEN`: bearer token required by `/mcp`.
- `AGENT_API_TOKEN`: bearer token required by task API routes.
- `OPENCLAW_GATEWAY_URL`: VPS OpenClaw-compatible gateway base URL.
- `OPENCLAW_GATEWAY_TOKEN`: bearer token for the VPS gateway.
- `OPENCLAW_DEFAULT_MODEL`: defaults to `anthropic/claude-opus-4.7`.
- `ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the API.

The VPS gateway also needs `OPENROUTER_API_KEY`, `APIMART_API_KEY`, and
`EGGAPI_API_KEY` because chat tasks route all text, image, and video work
through OpenClaw runs.

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
