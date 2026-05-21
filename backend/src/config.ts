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
  mcpAuthToken: process.env.MCP_AUTH_TOKEN || "",
  agentApiToken: process.env.AGENT_API_TOKEN || "",
  openClawGatewayUrl: (process.env.OPENCLAW_GATEWAY_URL || "").replace(/\/$/, ""),
  openClawGatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || "",
  openClawFetchTimeoutMs: numberEnv("OPENCLAW_FETCH_TIMEOUT_MS", 15_000),
  openClawSyncIntervalMs: numberEnv("OPENCLAW_SYNC_INTERVAL_MS", 5_000),
  openClawSyncBatchSize: numberEnv("OPENCLAW_SYNC_BATCH_SIZE", 25),
  kieAiApiKey: process.env.KIE_AI_API_KEY || "",
  kieAiBaseUrl: (process.env.KIE_AI_BASE_URL || "https://api.kie.ai").replace(/\/$/, ""),
  kieAiOmniModel: process.env.KIE_AI_GEMINI_OMNI_MODEL || "gemini-omni-video",
}

export function requireConfig(value: string, message: string) {
  if (!value) {
    throw new Error(message)
  }

  return value
}
