const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://geminispark.ai",
  "https://www.geminispark.ai",
]

function numberEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function listEnv(name: string, fallback: string[]) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export const config = {
  port: numberEnv("PORT", 10000),
  nodeEnv: process.env.NODE_ENV || "development",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  allowedOrigins: listEnv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  workerConcurrency: numberEnv("WORKER_CONCURRENCY", 5),
  mediaPollTimeoutMs: numberEnv("MEDIA_POLL_TIMEOUT_MS", 600_000),
  mediaPollIntervalMs: numberEnv("MEDIA_POLL_INTERVAL_MS", 5_000),
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  apimartApiKey: process.env.APIMART_API_KEY || "",
  eggApiApiKey: process.env.EGGAPI_API_KEY || "",
  mcpAuthToken: process.env.MCP_AUTH_TOKEN || "",
  agentApiToken: process.env.AGENT_API_TOKEN || "",
  openClawGatewayUrl: (process.env.OPENCLAW_GATEWAY_URL || "").replace(/\/$/, ""),
  openClawGatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || "",
  openClawDefaultModel: process.env.OPENCLAW_DEFAULT_MODEL || "anthropic/claude-opus-4.7",
  openClawPollTimeoutMs: numberEnv("OPENCLAW_POLL_TIMEOUT_MS", 600_000),
  openClawPollIntervalMs: numberEnv("OPENCLAW_POLL_INTERVAL_MS", 2_000),
}

export function requireConfig(value: string, message: string) {
  if (!value) {
    throw new Error(message)
  }

  return value
}
