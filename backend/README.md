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
- `ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the API.

## API

- `GET /health`
- `POST /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/events`
- `POST /tasks/:taskId/cancel`
- `POST /mcp`

Task create/read/cancel endpoints require a stable per-client owner id through
the `x-geminispark-client-id` header. Browser SSE cannot attach custom headers,
so `GET /tasks/:taskId/events` also accepts the same value as `?clientId=...`.

The frontend expects `NEXT_PUBLIC_AGENT_API_URL` to point at the Render API URL.
