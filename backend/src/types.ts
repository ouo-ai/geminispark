export type ClientAttachment = {
  name: string
  type: string
  dataUrl?: string
  url?: string
}

export type ClientMessage = {
  role: "assistant" | "user"
  body: string
}

export type AgentIntent = "text" | "image" | "text-to-video" | "image-to-video"

export type TaskInput = {
  message: string
  attachments: ClientAttachment[]
  history: ClientMessage[]
  sessionId?: string
  clientTaskId?: string
  externalUserId?: string
}

export type AgentMedia = {
  type: "image" | "video"
  urls: string[]
}

export type ProviderResult = {
  intent: AgentIntent
  provider: string
  model: string
  message: string
  taskId?: string
  runtimeRunId?: string
  runtimeSessionId?: string
  workspaceId?: string
  media?: AgentMedia
  usage?: unknown
  raw?: unknown
}

export type RuntimeRunSnapshot = {
  intent: AgentIntent
  status: "queued" | "running" | "succeeded" | "failed" | "canceled"
  provider: string
  model: string
  message: string
  taskId?: string
  runtimeRunId?: string
  runtimeSessionId?: string
  workspaceId?: string
  media?: AgentMedia
  artifacts?: Array<{ type?: string; text?: string; url?: string }>
  events: ProviderEvent[]
  error?: string
  raw?: unknown
}

export type ProviderEvent = {
  id?: string
  type: string
  message: string
  data?: unknown
  createdAt?: string
}

export type QueuedTaskJob = {
  taskId: string
}
