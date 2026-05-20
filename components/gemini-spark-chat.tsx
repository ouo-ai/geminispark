"use client"

import { type ChangeEvent, type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CreditCard,
  ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  Video,
  Wallet,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { BILLING_PLANS, type BillingInterval, type PaidPlan } from "@/lib/billing-config"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type ClientAttachment = {
  id: string
  name: string
  type: string
  dataUrl: string
}

type AgentMedia = {
  type: "image" | "video"
  urls: string[]
}

type ChatMessage = {
  id: string
  taskId?: string
  role: "assistant" | "user"
  body: string
  status?: "thinking" | "done" | "error"
  provider?: string
  model?: string
  intent?: string
  media?: AgentMedia
  workspaceId?: string | null
  events?: AgentTaskEvent[]
  attachments?: ClientAttachment[]
}

type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

type ChatState = {
  activeSessionId: string
  sessions: ChatSession[]
}

type AgentResponse = {
  intent: string
  provider: string
  model: string
  message: string
  taskId?: string
  media?: AgentMedia
}

type AgentTaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled"

type AgentTaskEvent = {
  id: string
  type: string
  message: string
  data?: Record<string, unknown> | null
  createdAt: string
}

type AgentTaskArtifact = {
  id: string
  kind: "text" | "image" | "video" | "other"
  url?: string | null
  text?: string | null
  createdAt: string
}

type AgentTask = {
  id: string
  projectAgentId?: string | null
  chatThreadId?: string | null
  intent: string
  status: AgentTaskStatus
  progress: number
  creditCost?: number
  workspaceId?: string | null
  provider?: string | null
  model?: string | null
  message?: string | null
  error?: string | null
  media?: AgentMedia
  artifacts?: AgentTaskArtifact[]
  events?: AgentTaskEvent[]
}

type ProjectAgent = {
  id: string
  name: string
  description?: string | null
  status: string
  workspaceId?: string | null
  runtimeAgentId?: string | null
  memorySummary?: string | null
  instructions?: string | null
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

type ChatThread = {
  id: string
  projectAgentId: string
  title: string
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

type AccountBootstrap = {
  profile?: {
    nickname?: string | null
    language?: string | null
    preferences?: unknown
    memorySummary?: string | null
  }
  credits: {
    freeCreditsRemaining: number
    periodCreditsRemaining: number
    totalCredits: number
    plan: string
    subscriptionStatus: string
    costs: {
      text: number
      image: number
      "text-to-video": number
      "image-to-video": number
    }
  }
  workspace: {
    provider: string
    status: string
    workspaceId: string | null
    runtimeAgentId?: string | null
    initializedAt?: string | null
    lastUsedAt?: string | null
    error?: string | null
  }
  projects: ProjectAgent[]
  activeProject: ProjectAgent
  threads: ChatThread[]
  activeThread: ChatThread
  messages?: ChatMessage[]
}

const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024
const MAX_PERSISTED_ATTACHMENT_BYTES = 400_000
const MAX_PERSISTED_SESSIONS = 30
const MAX_PERSISTED_MESSAGES = 120
const MAX_PERSISTED_EVENTS = 80
const AGENT_BRAND = "Gemini Spark"
const CHAT_STORAGE_KEY_PREFIX = "gemini-spark:chat-sessions:v2"
const CHAT_STORAGE_VERSION = 2
const AGENT_API_BASE_PATH = "/api/gemini-spark"
const WELCOME_MESSAGE =
  "Sign in to initialize your Gemini Spark workspace, then send text, image, or video tasks through the agent."
const EMPTY_THREADS: ChatThread[] = []

const quickPrompts = [
  "Create a cinematic product video from this idea.",
  "Generate a 16:9 image concept for this campaign.",
  "Turn this into a concise agent plan.",
]

const thinkingLines = [
  "Connecting to Gemini Spark...",
  "Reading the workspace context...",
  "Checking whether this should be text, image, or video...",
  "Preparing the Gemini Spark run...",
  "Selecting the safest tool path...",
  "Inspecting attached media and prompt intent...",
  "Separating planning work from generation work...",
  "Estimating whether a media task needs async polling...",
  "Preparing a server-side request payload...",
  "Keeping keys server-side and away from the browser...",
  "Choosing the most reliable execution path...",
  "Holding the 30-second pre-think window...",
  "Finalizing the Gemini Spark plan...",
  "Starting the server request...",
  "Waiting for upstream processing...",
  "Checking task progress and available output URLs...",
  "Normalizing the Gemini Spark response...",
  "Looking for generated media assets...",
  "Packaging the result for the chat session...",
  "Preparing a concise agent summary...",
  "Still waiting for the best available result...",
  "Media jobs can take longer than text responses...",
  "Keeping the session active while Gemini Spark works...",
  "Almost ready to return the agent output...",
]

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function agentApiUrl(path: string) {
  return `${AGENT_API_BASE_PATH}${path}`
}

function currentUrlSearch() {
  if (typeof window === "undefined") {
    return ""
  }

  return window.location.search
}

function chatThreadPath(threadId: string, keepCurrentSearch = true) {
  return `/gemini-spark/t/${encodeURIComponent(threadId)}${keepCurrentSearch ? currentUrlSearch() : ""}`
}

function isCurrentThreadUrl(threadId: string) {
  if (typeof window === "undefined") {
    return false
  }

  return window.location.pathname === `/gemini-spark/t/${encodeURIComponent(threadId)}`
}

async function readJsonBody<T extends object>(response: Response, fallbackError: string): Promise<T & { error?: string }> {
  const text = await response.text()
  if (!text.trim()) {
    return { error: fallbackError } as T & { error?: string }
  }

  try {
    return JSON.parse(text) as T & { error?: string }
  } catch {
    return { error: fallbackError } as T & { error?: string }
  }
}

function latestTaskEvent(task: AgentTask) {
  return task.events?.[task.events.length - 1]
}

function displayBrandText(value: string) {
  return value
    .replace(/\bOpenClaw\b/g, AGENT_BRAND)
    .replace(/anthropic\/claude[\w./-]*/gi, AGENT_BRAND)
    .replace(/\bclaude[\w./-]*4\.7[\w./-]*\b/gi, AGENT_BRAND)
    .replace(/\bclaude[\w./-]*opus[\w./-]*\b/gi, AGENT_BRAND)
    .replace(/\bClaude\s+(?:Opus\s+)?4\.7(?:\s+Opus)?\b/gi, AGENT_BRAND)
}

function taskToAgentResponse(task: AgentTask): AgentResponse {
  const textArtifact = task.artifacts?.find((artifact) => artifact.kind === "text" && artifact.text)
  const message =
    task.message ||
    textArtifact?.text ||
    task.error ||
    latestTaskEvent(task)?.message ||
    "Gemini Spark task finished without a message."

  return {
    intent: task.intent,
    provider: task.provider || AGENT_BRAND,
    model: AGENT_BRAND,
    message: displayBrandText(message),
    taskId: task.id,
    media: task.media,
  }
}

function eventData(event: AgentTaskEvent) {
  return event.data && typeof event.data === "object" ? event.data : {}
}

function isOpenClawEvent(event: AgentTaskEvent) {
  const data = eventData(event)
  return data.source === "openclaw" || event.type.startsWith("openclaw") || event.type.includes("workspace") || event.type.includes("tool") || event.type.includes("provider") || event.type.includes("artifact") || event.type === "run_created" || event.type === "model_selected" || event.type === "completed"
}

function isRuntimeTraceEvent(event: AgentTaskEvent) {
  return eventData(event).runtimeSource === "openclaw-trajectory"
}

function runtimeEventTypeLabel(event: AgentTaskEvent) {
  const rawType = eventData(event).rawType
  return typeof rawType === "string" ? rawType : event.type
}

function shortWorkspaceId(workspaceId?: string | null) {
  if (!workspaceId) {
    return "pending"
  }

  return workspaceId.length > 12 ? `${workspaceId.slice(0, 8)}...${workspaceId.slice(-4)}` : workspaceId
}

function workspaceGateState(
  isSignedIn: boolean,
  isSessionPending: boolean,
  account: AccountBootstrap | null,
  bootstrapError: string,
) {
  if (!isSignedIn) {
    return "signed-out" as const
  }

  if (isSessionPending || (!account && !bootstrapError)) {
    return "initializing" as const
  }

  const status = account?.workspace.status.toLowerCase()
  if (status === "ready") {
    return "ready" as const
  }

  if (bootstrapError || status === "failed" || status === "missing") {
    return "failed" as const
  }

  return "initializing" as const
}

function WorkspaceInitializationPanel({
  state,
  workspace,
  error,
  onRetry,
}: {
  state: "initializing" | "failed"
  workspace?: AccountBootstrap["workspace"]
  error: string
  onRetry: () => void
}) {
  const failed = state === "failed"

  return (
    <div className="border-b border-border bg-background/55 px-4 py-4 sm:px-5 xl:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
              failed ? "border-destructive/35 bg-destructive/10 text-destructive" : "border-primary/35 bg-primary/10 text-primary",
            )}
          >
            {failed ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {failed ? "Gemini Spark workspace needs attention" : "Initializing Gemini Spark workspace"}
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {failed
                ? displayBrandText(workspace?.error || error || "The workspace could not be initialized. Retry before sending a message.")
                : "Preparing an isolated VPS workspace and connecting the agent runtime before chat starts."}
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 lg:min-w-[420px]">
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            User isolated
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2">
            <Server className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {shortWorkspaceId(workspace?.workspaceId)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2">
            <Terminal className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {failed ? "Retry required" : "Connecting"}
          </span>
        </div>
        {failed && (
          <Button type="button" size="sm" rounded="full" className="w-fit gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

function SidebarLoadingRow({ collapsed, label }: { collapsed: boolean; label: string }) {
  return (
    <div
      className={cn(
        "grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 rounded-lg border border-border/70 bg-background/35 px-2.5 py-2 text-muted-foreground",
        collapsed && "lg:size-11 lg:min-h-0 lg:grid-cols-1 lg:place-items-center lg:p-0",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </span>
      <span className={cn("min-w-0 text-sm", collapsed && "lg:hidden")}>{label}</span>
    </div>
  )
}

function SidebarErrorRow({ collapsed, label }: { collapsed: boolean; label: string }) {
  return (
    <div
      className={cn(
        "grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 rounded-lg border border-destructive/35 bg-destructive/10 px-2.5 py-2 text-destructive",
        collapsed && "lg:size-11 lg:min-h-0 lg:grid-cols-1 lg:place-items-center lg:p-0",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-destructive/35 bg-destructive/10 text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className={cn("min-w-0 text-sm", collapsed && "lg:hidden")}>{label}</span>
    </div>
  )
}

function OpenClawActivity({
  events,
  workspaceId,
  model,
  status,
}: {
  events?: AgentTaskEvent[]
  workspaceId?: string | null
  model?: string
  status?: ChatMessage["status"]
}) {
  const allEvents = events || []
  const runtimeTraceEvents = allEvents.filter(isRuntimeTraceEvent)
  const activity = runtimeTraceEvents.length > 0 ? runtimeTraceEvents : allEvents.filter(isOpenClawEvent)
  if (activity.length === 0 && !workspaceId && !model) {
    return null
  }

  const latest = activity[activity.length - 1]
  const artifactEvents = activity.filter((event) => typeof eventData(event).artifactUrl === "string")
  const isTerminal = status === "done" || status === "error"

  return (
    <details
      key={`activity-${isTerminal ? "terminal" : "live"}-${activity.length}`}
      open={!isTerminal || undefined}
      className="mt-3 border-t border-border/80 pt-3 text-xs"
    >
      <summary className="mb-2 flex cursor-pointer list-none flex-wrap items-center gap-2 text-foreground [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Terminal className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Gemini Spark Activity
        </span>
        {activity.length > 0 && (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-muted-foreground">
            {activity.length} runtime events
          </span>
        )}
        {workspaceId && (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-muted-foreground">
            {shortWorkspaceId(workspaceId)}
          </span>
        )}
        {model && (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-muted-foreground">
            {model}
          </span>
        )}
      </summary>
      {latest && <p className="mb-2 text-muted-foreground">{displayBrandText(latest.message)}</p>}
      {activity.length > 0 && (
        <div className="grid gap-1.5">
          {activity.map((event) => (
            <div key={event.id} className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="shrink-0 font-mono text-[11px] text-foreground/80">{runtimeEventTypeLabel(event)}</span>
              <span className="min-w-0 truncate">{displayBrandText(event.message)}</span>
            </div>
          ))}
        </div>
      )}
      {artifactEvents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {artifactEvents.map((event) => {
            const data = eventData(event)
            const url = typeof data.artifactUrl === "string" ? data.artifactUrl : ""
            return (
              <a
                key={`${event.id}-${url}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-primary transition hover:bg-primary/15"
              >
                {typeof data.artifactType === "string" ? data.artifactType : "artifact"}
              </a>
            )
          })}
        </div>
      )}
    </details>
  )
}

async function fetchTask(taskId: string) {
  const response = await fetch(agentApiUrl(`/tasks/${encodeURIComponent(taskId)}`), {
    headers: {
      Accept: "application/json",
    },
  })
  const data = await readJsonBody<AgentTask>(response, "Task request returned an invalid response.")

  if (!response.ok) {
    throw new Error(("error" in data && data.error) || "Task request failed.")
  }

  return data as AgentTask
}

async function fetchAccountBootstrap(projectAgentId?: string | null, chatThreadId?: string | null) {
  const url = new URL(agentApiUrl("/bootstrap"), window.location.origin)
  if (projectAgentId) {
    url.searchParams.set("projectAgentId", projectAgentId)
  }
  if (chatThreadId) {
    url.searchParams.set("chatThreadId", chatThreadId)
  }

  const response = await fetch(url.pathname + url.search, {
    headers: {
      Accept: "application/json",
    },
  })
  const data = await readJsonBody<AccountBootstrap>(response, "Gemini Spark workspace initialization returned an invalid response.")

  if (!response.ok) {
    throw new Error(("error" in data && data.error) || "Account initialization failed.")
  }

  return data as AccountBootstrap
}

async function createProjectRequest(name: string) {
  const response = await fetch(agentApiUrl("/projects"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  })
  const data = await readJsonBody<{ project?: ProjectAgent; thread?: ChatThread }>(response, "Project could not be created.")

  if (!response.ok || !data.project || !data.thread) {
    throw new Error(data.error || "Project could not be created.")
  }

  return { project: data.project, thread: data.thread }
}

async function createThreadRequest(projectAgentId: string, title = "New chat") {
  const response = await fetch(agentApiUrl(`/projects/${encodeURIComponent(projectAgentId)}/threads`), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  })
  const data = await readJsonBody<{ thread?: ChatThread }>(response, "Chat could not be created.")

  if (!response.ok || !data.thread) {
    throw new Error(data.error || "Chat could not be created.")
  }

  return data.thread
}

async function fetchThreadMessagesRequest(threadId: string) {
  const response = await fetch(agentApiUrl(`/threads/${encodeURIComponent(threadId)}/messages`), {
    headers: {
      Accept: "application/json",
    },
  })
  const data = await readJsonBody<{ messages?: ChatMessage[] }>(response, "Chat history could not be loaded.")

  if (!response.ok || !Array.isArray(data.messages)) {
    throw new Error(data.error || "Chat history could not be loaded.")
  }

  return data.messages
}

function isTerminalTask(task: AgentTask) {
  return task.status === "succeeded" || task.status === "failed" || task.status === "canceled"
}

async function pollTaskUntilDone(taskId: string, onUpdate: (task: AgentTask) => void) {
  for (;;) {
    const task = await fetchTask(taskId)
    onUpdate(task)

    if (isTerminalTask(task)) {
      return task
    }

    await wait(2_000)
  }
}

async function waitForTaskCompletion(taskId: string, onUpdate: (task: AgentTask) => void) {
  if (typeof EventSource === "undefined") {
    return pollTaskUntilDone(taskId, onUpdate)
  }

  return new Promise<AgentTask>((resolve, reject) => {
    let settled = false
    const source = new EventSource(agentApiUrl(`/tasks/${encodeURIComponent(taskId)}/events`))

    function settle(callback: () => void) {
      if (settled) {
        return
      }

      settled = true
      source.close()
      callback()
    }

    source.addEventListener("task", (event) => {
      try {
        const task = JSON.parse((event as MessageEvent).data) as AgentTask
        onUpdate(task)

        if (isTerminalTask(task)) {
          settle(() => resolve(task))
        }
      } catch (error) {
        settle(() => reject(error))
      }
    })

    source.addEventListener("error", () => {
      source.close()
      pollTaskUntilDone(taskId, onUpdate).then(resolve, reject)
    })
  })
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createChatSession(thread?: ChatThread, messages?: ChatMessage[]): ChatSession {
  const now = Date.now()
  const id = thread?.id || createId("session")

  return {
    id,
    title: thread?.title || "New chat",
    createdAt: thread ? new Date(thread.createdAt).getTime() : now,
    updatedAt: thread ? new Date(thread.updatedAt).getTime() : now,
    messages:
      messages && messages.length > 0
        ? messages
        : [
            {
              id: createId("assistant"),
              role: "assistant",
              body: WELCOME_MESSAGE,
            },
          ],
  }
}

function createInitialChatState(threads: ChatThread[] = [], activeThreadId?: string, activeMessages: ChatMessage[] = []): ChatState {
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0]
  const initialSession = createChatSession(activeThread, activeMessages)

  return {
    activeSessionId: initialSession.id,
    sessions:
      threads.length > 0
        ? threads.map((thread) => createChatSession(thread, thread.id === initialSession.id ? activeMessages : undefined))
        : [initialSession],
  }
}

function chatStorageKey(ownerId?: string | null, projectAgentId?: string | null) {
  if (!ownerId) {
    return `${CHAT_STORAGE_KEY_PREFIX}:signed-out`
  }

  return `${CHAT_STORAGE_KEY_PREFIX}:user:${encodeURIComponent(ownerId)}:project:${encodeURIComponent(projectAgentId || "pending")}`
}

function sortSessionsByActivity(sessions: ChatSession[]) {
  return [...sessions].sort((first, second) => second.updatedAt - first.updatedAt)
}

function sessionHasUserMessages(session: ChatSession) {
  return session.messages.some((message) => message.role === "user")
}

function isChatMessage(value: ChatMessage | null): value is ChatMessage {
  return value !== null
}

function isChatSession(value: ChatSession | null): value is ChatSession {
  return value !== null
}

function sanitizeMessageForStorage(message: ChatMessage): ChatMessage {
  const attachments = message.attachments?.filter((attachment) => attachment.dataUrl.length <= MAX_PERSISTED_ATTACHMENT_BYTES)

  return {
    ...message,
    events: message.events?.slice(-MAX_PERSISTED_EVENTS),
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  }
}

function normalizeStoredEvent(value: unknown): AgentTaskEvent | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const item = value as Partial<AgentTaskEvent>
  if (typeof item.id !== "string" || typeof item.type !== "string" || typeof item.message !== "string" || typeof item.createdAt !== "string") {
    return null
  }

  return {
    id: item.id,
    type: item.type,
    message: item.message,
    data: item.data && typeof item.data === "object" ? (item.data as Record<string, unknown>) : null,
    createdAt: item.createdAt,
  }
}

function prepareChatStateForStorage(state: ChatState): ChatState {
  const sessions = sortSessionsByActivity(state.sessions)
    .slice(0, MAX_PERSISTED_SESSIONS)
    .map((session) => ({
      ...session,
      messages: session.messages.slice(-MAX_PERSISTED_MESSAGES).map(sanitizeMessageForStorage),
    }))

  const activeSessionId = sessions.some((session) => session.id === state.activeSessionId)
    ? state.activeSessionId
    : sessions[0]?.id

  return {
    activeSessionId,
    sessions: sessions.length > 0 ? sessions : createInitialChatState().sessions,
  }
}

function reconcileChatStateWithThreads(
  state: ChatState,
  threads: ChatThread[],
  activeThreadId?: string,
  activeMessages: ChatMessage[] = [],
) {
  if (threads.length === 0) {
    return state.sessions.length > 0 ? state : createInitialChatState()
  }

  const threadIds = new Set(threads.map((thread) => thread.id))
  const threadById = new Map(threads.map((thread) => [thread.id, thread]))
  const storedSessions = state.sessions
    .filter((session) => threadIds.has(session.id))
    .map((session) => {
      if (session.id !== activeThreadId) {
        return session
      }

      return {
        ...session,
        messages: activeMessages.length > 0 ? activeMessages : createChatSession(threadById.get(session.id)).messages,
        updatedAt: Date.now(),
      }
    })
  const storedIds = new Set(storedSessions.map((session) => session.id))
  const missingSessions = threads
    .filter((thread) => !storedIds.has(thread.id))
    .map((thread) => createChatSession(thread, thread.id === activeThreadId ? activeMessages : undefined))
  const sessions = sortSessionsByActivity([...storedSessions, ...missingSessions])
  const activeSessionId =
    activeThreadId && sessions.some((session) => session.id === activeThreadId)
      ? activeThreadId
      : sessions.some((session) => session.id === state.activeSessionId)
        ? state.activeSessionId
        : sessions[0].id

  return {
    activeSessionId,
    sessions,
  }
}

function normalizeStoredMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const item = value as Partial<ChatMessage>

  if (typeof item.id !== "string" || (item.role !== "assistant" && item.role !== "user") || typeof item.body !== "string") {
    return null
  }

  const message: ChatMessage = {
    id: item.id,
    role: item.role,
    body: displayBrandText(item.body),
  }

  if (typeof item.taskId === "string") {
    message.taskId = item.taskId
  }

  if (item.status === "done" || item.status === "error") {
    message.status = item.status
  } else if (item.status === "thinking") {
    message.status = "error"
    message.body = "This request was interrupted before Gemini Spark finished."
  }

  if (typeof item.provider === "string") {
    message.provider = AGENT_BRAND
  }

  if (typeof item.model === "string") {
    message.model = AGENT_BRAND
  }

  if (typeof item.intent === "string") {
    message.intent = item.intent
  }

  if (Array.isArray(item.events)) {
    const events = item.events.map(normalizeStoredEvent).filter((event): event is AgentTaskEvent => event !== null)
    if (events.length > 0) {
      message.events = events.slice(-MAX_PERSISTED_EVENTS)
    }
  }

  if (item.media?.type && Array.isArray(item.media.urls)) {
    const urls = item.media.urls.filter((url) => typeof url === "string")
    if ((item.media.type === "image" || item.media.type === "video") && urls.length > 0) {
      message.media = {
        type: item.media.type,
        urls,
      }
    }
  }

  if (Array.isArray(item.attachments)) {
    const attachments = item.attachments.filter(
      (attachment): attachment is ClientAttachment =>
        Boolean(
          attachment &&
            typeof attachment.id === "string" &&
            typeof attachment.name === "string" &&
            typeof attachment.type === "string" &&
            typeof attachment.dataUrl === "string" &&
            attachment.dataUrl.length <= MAX_PERSISTED_ATTACHMENT_BYTES,
        ),
    )

    if (attachments.length > 0) {
      message.attachments = attachments
    }
  }

  return message
}

function normalizeStoredSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const item = value as Partial<ChatSession>
  const messages = Array.isArray(item.messages) ? item.messages.map(normalizeStoredMessage).filter(isChatMessage) : []

  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.createdAt !== "number" ||
    typeof item.updatedAt !== "number" ||
    messages.length === 0
  ) {
    return null
  }

  return {
    id: item.id,
    title: item.title,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    messages,
  }
}

function loadStoredSnapshot(storageKey: string): { chatState: ChatState; draft: string } | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as {
      version?: number
      chatState?: Partial<ChatState>
      draft?: unknown
    }
    const sessions = Array.isArray(parsed.chatState?.sessions)
      ? parsed.chatState.sessions.map(normalizeStoredSession).filter(isChatSession)
      : []

    if (parsed.version !== CHAT_STORAGE_VERSION || sessions.length === 0) {
      return null
    }

    const activeSessionId =
      typeof parsed.chatState?.activeSessionId === "string" &&
      sessions.some((session) => session.id === parsed.chatState?.activeSessionId)
        ? parsed.chatState.activeSessionId
        : sessions[0].id

    return {
      chatState: {
        activeSessionId,
        sessions: sortSessionsByActivity(sessions),
      },
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
    }
  } catch {
    return null
  }
}

function saveStoredSnapshot(storageKey: string, chatState: ChatState, draft: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: CHAT_STORAGE_VERSION,
        chatState: prepareChatStateForStorage(chatState),
        draft,
      }),
    )
  } catch {
    // Ignore quota and private-mode storage failures; the chat should keep working in memory.
  }
}

function applyUrlPromptToChatState(state: ChatState, prompt: string) {
  const sentSessionForPrompt = state.sessions.find((session) =>
    session.messages.some((message) => message.role === "user" && message.body.trim() === prompt),
  )

  if (sentSessionForPrompt) {
    return {
      chatState: {
        ...state,
        activeSessionId: sentSessionForPrompt.id,
      },
      draft: "",
    }
  }

  const active = state.sessions.find((session) => session.id === state.activeSessionId)
  const shouldReuseActiveSession = active && !sessionHasUserMessages(active)

  if (!shouldReuseActiveSession) {
    return {
      chatState: {
        ...state,
      },
      draft: prompt,
    }
  }

  return {
    chatState: {
      ...state,
      sessions: state.sessions.map((session) =>
        session.id === state.activeSessionId
          ? {
              ...session,
              title: makeSessionTitle(prompt, []),
              updatedAt: Date.now(),
            }
          : session,
      ),
    },
    draft: prompt,
  }
}

function makeSessionTitle(prompt: string, attachments: ClientAttachment[]) {
  const normalized = prompt.replace(/\s+/g, " ").trim()

  if (normalized) {
    return normalized.length > 54 ? `${normalized.slice(0, 51)}...` : normalized
  }

  if (attachments.some((attachment) => attachment.type.startsWith("video/"))) {
    return "Video request"
  }

  if (attachments.some((attachment) => attachment.type.startsWith("image/"))) {
    return "Image request"
  }

  return "New chat"
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function attachmentKind(attachment: ClientAttachment) {
  if (attachment.type.startsWith("image/")) {
    return "image"
  }

  if (attachment.type.startsWith("video/")) {
    return "video"
  }

  return "file"
}

function latestAssistantResult(session: ChatSession) {
  return session.messages.findLast((message) => message.role === "assistant" && message.status !== undefined)
}

function sessionSubtitle(session: ChatSession) {
  const latestResult = latestAssistantResult(session)
  const userTurns = session.messages.filter((message) => message.role === "user").length

  if (latestResult?.status === "thinking") {
    return "Thinking..."
  }

  if (latestResult?.status === "error") {
    return "Needs attention"
  }

  if (latestResult?.provider) {
    return AGENT_BRAND
  }

  if (userTurns > 0) {
    return `${userTurns} turn${userTurns === 1 ? "" : "s"}`
  }

  return "Ready"
}

function sessionIcon(session: ChatSession) {
  const latestResult = latestAssistantResult(session)

  if (latestResult?.intent === "image") {
    return ImageIcon
  }

  if (latestResult?.intent === "text-to-video" || latestResult?.intent === "image-to-video") {
    return Video
  }

  return MessageSquare
}

function MarkdownMessage({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", isUser ? "text-primary-foreground" : "text-foreground/90")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="mb-3 text-xl font-semibold leading-7 text-foreground">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 text-lg font-semibold leading-7 text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 text-base font-semibold leading-6 text-foreground">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 text-sm font-semibold leading-6 text-foreground">{children}</h4>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-6">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="text-foreground/80">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-primary/45 pl-4 text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="my-4 border-border" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn("underline underline-offset-4", isUser ? "text-primary-foreground" : "text-primary")}
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-")

            if (isBlock) {
              return (
                <code className={cn("block overflow-x-auto rounded-lg bg-background/80 p-3 text-xs leading-6", className)}>
                  {children}
                </code>
              )
            }

            return (
              <code className="rounded border border-border bg-background/70 px-1.5 py-0.5 text-[0.85em] text-foreground">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-lg p-0">{children}</pre>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-primary/10 text-foreground">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr className="border-border">{children}</tr>,
          th: ({ children }) => <th className="whitespace-nowrap border-r border-border px-3 py-2 font-semibold last:border-r-0">{children}</th>,
          td: ({ children }) => <td className="border-r border-border px-3 py-2 align-top text-muted-foreground last:border-r-0">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function GeminiSparkChat({ initialThreadId }: { initialThreadId?: string } = {}) {
  const router = useRouter()
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<ClientAttachment[]>([])
  const [isSessionPanelCollapsed, setIsSessionPanelCollapsed] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [thinkingIndex, setThinkingIndex] = useState(0)
  const [attachmentError, setAttachmentError] = useState("")
  const [account, setAccount] = useState<AccountBootstrap | null>(null)
  const [bootstrapError, setBootstrapError] = useState("")
  const [billingOpen, setBillingOpen] = useState(false)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("year")
  const [billingError, setBillingError] = useState("")
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [projectActionError, setProjectActionError] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const hasLoadedUrlPromptRef = useRef(false)
  const resumingTaskIdsRef = useRef<Set<string>>(new Set())
  const [chatState, setChatState] = useState<ChatState>(() => createInitialChatState())
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null)
  const activeProject =
    account?.projects.find((project) => project.id === activeProjectId) || account?.activeProject || null
  const isActiveProjectBootstrapped = !activeProject || account?.activeProject.id === activeProject.id
  const projectThreads = activeProject && isActiveProjectBootstrapped ? account?.threads || EMPTY_THREADS : EMPTY_THREADS
  const ownerStorageKey = chatStorageKey(session?.user.id, activeProject?.id)

  const activeSession =
    chatState.sessions.find((session) => session.id === chatState.activeSessionId) ?? chatState.sessions[0]
  const messages = activeSession.messages
  const hasConversationStarted = messages.some((message) => message.role === "user")
  const visibleMessages = hasConversationStarted
    ? messages.filter((message, index) => !(index === 0 && message.role === "assistant" && message.body === WELCOME_MESSAGE))
    : []
  const latestVisibleMessage = visibleMessages[visibleMessages.length - 1]
  const latestMediaKey = latestVisibleMessage?.media?.urls.join("|") ?? ""
  const isSignedIn = Boolean(session?.user)
  const workspaceState =
    isSignedIn && !isActiveProjectBootstrapped
      ? ("initializing" as const)
      : workspaceGateState(isSignedIn, isSessionPending, account, bootstrapError)
  const isWorkspaceReady = workspaceState === "ready"
  const isWorkspaceBlocked = isSignedIn && !isWorkspaceReady && (Boolean(account) || Boolean(bootstrapError))
  const isAccountLoading = isSessionPending || (isSignedIn && !account && !bootstrapError)
  const isChatNavigationPending =
    isSessionPending || (isSignedIn && (!account || !isActiveProjectBootstrapped || !isStorageReady))
  const isChatNavigationLoading =
    isChatNavigationPending && !bootstrapError
  const isChatInputDisabled = isThinking || !isSignedIn || !isWorkspaceReady || isChatNavigationPending

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    window.requestAnimationFrame(() => {
      const viewport = messagesViewportRef.current

      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior,
        })
        return
      }

      messagesEndRef.current?.scrollIntoView({ block: "end", behavior })
    })
  }, [])

  function signInWithGoogle() {
    void authClient.signIn.social({
      provider: "google",
      callbackURL: initialThreadId ? chatThreadPath(initialThreadId) : `/gemini-spark${currentUrlSearch()}`,
    })
  }

  function signOut() {
    setChatState(createInitialChatState())
    setDraft("")
    setAttachments([])
    setAttachmentError("")
    setAccount(null)
    setBootstrapError("")
    setActiveProjectId(null)
    setProjectActionError("")
    setIsStorageReady(false)
    setLoadedStorageKey(null)
    void authClient.signOut()
  }

  async function refreshAccount(projectAgentId?: string | null, chatThreadId?: string | null) {
    setBootstrapError("")

    try {
      const targetProjectAgentId = projectAgentId === undefined ? activeProject?.id : projectAgentId
      const targetChatThreadId = chatThreadId === undefined ? activeSession?.id : chatThreadId
      const nextAccount = await fetchAccountBootstrap(targetProjectAgentId, targetChatThreadId)
      setAccount(nextAccount)
      setActiveProjectId(nextAccount.activeProject.id)
      return nextAccount
    } catch (error) {
      const message = displayBrandText(error instanceof Error ? error.message : "Gemini Spark workspace initialization failed.")
      setAccount(null)
      setBootstrapError(message)
      throw error
    }
  }

  async function startCheckout(plan: PaidPlan) {
    setBillingError("")
    setCheckoutPlan(plan)

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, interval: billingInterval }),
      })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout could not be started.")
      }

      window.location.assign(data.url)
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Checkout could not be started.")
    } finally {
      setCheckoutPlan(null)
    }
  }

  async function openBillingPortal() {
    setBillingError("")

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Billing portal could not be opened.")
      }

      window.location.assign(data.url)
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Billing portal could not be opened.")
      setBillingOpen(true)
    }
  }

  useEffect(() => {
    if (isSessionPending) {
      return
    }

    if (isSignedIn && (!activeProject?.id || !isActiveProjectBootstrapped)) {
      return
    }

    if (isStorageReady && loadedStorageKey === ownerStorageKey) {
      return
    }

    setIsStorageReady(false)
    setLoadedStorageKey(null)

    const stored = loadStoredSnapshot(ownerStorageKey)
    const params = new URLSearchParams(window.location.search)
    const shouldApplyUrlPrompt = !hasLoadedUrlPromptRef.current
    const prompt = shouldApplyUrlPrompt ? params.get("prompt")?.trim() : ""
    const activeThreadMessages = account?.messages || []
    let nextChatState = stored?.chatState ?? createInitialChatState(projectThreads, account?.activeThread.id, activeThreadMessages)
    let nextDraft = stored?.draft ?? ""

    nextChatState = reconcileChatStateWithThreads(nextChatState, projectThreads, account?.activeThread.id, activeThreadMessages)

    if (shouldApplyUrlPrompt) {
      hasLoadedUrlPromptRef.current = true
    }

    if (prompt) {
      const applied = applyUrlPromptToChatState(nextChatState, prompt)
      nextChatState = applied.chatState
      nextDraft = applied.draft
      if (initialThreadId) {
        window.history.replaceState(null, "", window.location.pathname)
      }
    }

    setChatState(nextChatState)
    setDraft(nextDraft)
    setLoadedStorageKey(ownerStorageKey)
    setIsStorageReady(true)
  }, [
    activeProject?.id,
    isActiveProjectBootstrapped,
    isSessionPending,
    isSignedIn,
    isStorageReady,
    loadedStorageKey,
    account?.activeThread.id,
    account?.messages,
    initialThreadId,
    ownerStorageKey,
    projectThreads,
  ])

  useEffect(() => {
    if (!initialThreadId || typeof window === "undefined" || !hasLoadedUrlPromptRef.current) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.has("prompt")) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [initialThreadId])

  useEffect(() => {
    if (!isSignedIn) {
      setAccount(null)
      setBootstrapError("")
      setIsStorageReady(false)
      setLoadedStorageKey(null)
      return
    }

    let cancelled = false
    setBootstrapError("")
    setIsStorageReady(false)
    setLoadedStorageKey(null)
    fetchAccountBootstrap(null, initialThreadId)
      .then((nextAccount) => {
        if (!cancelled) {
          setAccount(nextAccount)
          setActiveProjectId(nextAccount.activeProject.id)
          setBootstrapError("")
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAccount(null)
          setBootstrapError(displayBrandText(error instanceof Error ? error.message : "Gemini Spark workspace initialization failed."))
        }
      })

    return () => {
      cancelled = true
    }
  }, [initialThreadId, isSignedIn, session?.user.id])

  useEffect(() => {
    if (!isSignedIn || !account?.activeThread.id) {
      return
    }

    const activeThreadId = account.activeThread.id
    const shouldCanonicalize = !initialThreadId || initialThreadId !== activeThreadId

    if (shouldCanonicalize && !isCurrentThreadUrl(activeThreadId)) {
      router.replace(chatThreadPath(activeThreadId))
    }
  }, [account?.activeThread.id, initialThreadId, isSignedIn, router])

  useEffect(() => {
    if (!activeProjectId && account?.activeProject.id) {
      setActiveProjectId(account.activeProject.id)
    }
  }, [account?.activeProject.id, activeProjectId])

  useEffect(() => {
    if (!isStorageReady || loadedStorageKey !== ownerStorageKey) {
      return
    }

    const timeout = window.setTimeout(() => {
      saveStoredSnapshot(ownerStorageKey, chatState, draft)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [chatState, draft, isStorageReady, loadedStorageKey, ownerStorageKey])

  useEffect(() => {
    if (!isThinking) {
      setThinkingIndex(0)
      return
    }

    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const nextIndex = Math.min(Math.floor(elapsed / 5_000), thinkingLines.length - 1)
      setThinkingIndex(nextIndex)
    }, 1_000)

    return () => window.clearInterval(interval)
  }, [isThinking])

  useEffect(() => {
    if (!hasConversationStarted) {
      return
    }

    const timeout = window.setTimeout(() => {
      scrollMessagesToBottom("smooth")
    }, 40)

    return () => window.clearTimeout(timeout)
  }, [
    activeSession.id,
    activeSession.updatedAt,
    hasConversationStarted,
    isThinking,
    latestMediaKey,
    latestVisibleMessage?.body,
    latestVisibleMessage?.id,
    latestVisibleMessage?.status,
    scrollMessagesToBottom,
    thinkingIndex,
    visibleMessages.length,
  ])

  useEffect(() => {
    if (!isSignedIn || !isWorkspaceReady) {
      return
    }

    const runningMessages = activeSession.messages.filter(
      (message) => message.role === "assistant" && message.status === "thinking" && message.taskId,
    )

    for (const message of runningMessages) {
      const taskId = message.taskId
      if (!taskId || resumingTaskIdsRef.current.has(taskId)) {
        continue
      }

      resumingTaskIdsRef.current.add(taskId)
      void waitForTaskCompletion(taskId, (task) => applyTaskToAssistantMessage(activeSession.id, message.id, task))
        .catch(() => undefined)
        .finally(() => {
          resumingTaskIdsRef.current.delete(taskId)
        })
    }
  }, [activeSession.id, activeSession.messages, isSignedIn, isWorkspaceReady])

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    setAttachmentError("")

    if (files.length === 0) {
      return
    }

    const accepted: ClientAttachment[] = []

    for (const file of files.slice(0, 4)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setAttachmentError("Only image and video files are supported.")
        continue
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError("Keep each attachment under 6 MB for this chat route.")
        continue
      }

      accepted.push({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file),
      })
    }

    setAttachments((current) => [...current, ...accepted].slice(0, 4))
    event.target.value = ""
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
  }

  async function startNewChat() {
    if (!isSignedIn) {
      signInWithGoogle()
      return
    }

    if (!activeProject?.id || isCreatingThread) {
      return
    }

    setIsCreatingThread(true)
    setProjectActionError("")

    try {
      const thread = await createThreadRequest(activeProject.id)
      const nextSession = createChatSession(thread)

      setAccount((current) =>
        current && current.activeProject.id === activeProject.id
          ? {
              ...current,
              threads: [thread, ...current.threads.filter((item) => item.id !== thread.id)],
              activeThread: thread,
            }
          : current,
      )
      setChatState((current) => ({
        activeSessionId: nextSession.id,
        sessions: [nextSession, ...current.sessions.filter((session) => session.id !== nextSession.id)],
      }))
      setDraft("")
      setAttachments([])
      setAttachmentError("")
      router.push(chatThreadPath(thread.id, false))
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Chat could not be created.")
    } finally {
      setIsCreatingThread(false)
    }
  }

  async function startNewProject() {
    if (!isSignedIn) {
      signInWithGoogle()
      return
    }

    if (isCreatingProject) {
      return
    }

    setIsCreatingProject(true)
    setProjectActionError("")

    try {
      const projectNumber = (account?.projects.length || 0) + 1
      const { project, thread } = await createProjectRequest(`Project ${projectNumber}`)
      const nextWorkspace = {
        provider: "openclaw",
        status: project.status,
        workspaceId: project.workspaceId || null,
        runtimeAgentId: project.runtimeAgentId || null,
        initializedAt: project.status.toLowerCase() === "ready" ? project.updatedAt : null,
        lastUsedAt: project.updatedAt,
        error: null,
      }

      setActiveProjectId(project.id)
      setAccount((current) =>
        current
          ? {
              ...current,
              projects: [project, ...current.projects.filter((item) => item.id !== project.id)],
              activeProject: project,
              threads: [thread],
              activeThread: thread,
              workspace: nextWorkspace,
            }
          : current,
      )
      setChatState(createInitialChatState([thread]))
      setDraft("")
      setAttachments([])
      setAttachmentError("")
      router.push(chatThreadPath(thread.id, false))
      void refreshAccount(project.id, thread.id).catch(() => undefined)
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Project could not be created.")
    } finally {
      setIsCreatingProject(false)
    }
  }

  function switchProject(projectId: string) {
    if (projectId === activeProject?.id) {
      return
    }

    setActiveProjectId(projectId)
    setProjectActionError("")
    setBootstrapError("")
    setIsStorageReady(false)
    void refreshAccount(projectId, null)
      .then((nextAccount) => {
        router.push(chatThreadPath(nextAccount.activeThread.id, false))
      })
      .catch(() => undefined)
  }

  function selectChatThread(threadId: string) {
    setProjectActionError("")
    if (!isCurrentThreadUrl(threadId)) {
      router.push(chatThreadPath(threadId, false))
    }
    setChatState((current) => ({
      ...current,
      activeSessionId: threadId,
    }))

    void fetchThreadMessagesRequest(threadId)
      .then((messages) => {
        setChatState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === threadId
              ? {
                  ...session,
                  messages:
                    messages.length > 0
                      ? messages
                      : createChatSession(projectThreads.find((thread) => thread.id === threadId)).messages,
                  updatedAt: Date.now(),
                }
              : session,
          ),
        }))
      })
      .catch((error) => {
        setProjectActionError(error instanceof Error ? error.message : "Chat history could not be loaded.")
      })
  }

  function applyTaskToAssistantMessage(sessionId: string, messageId: string, task: AgentTask) {
    const latestEvent = latestTaskEvent(task)
    const pendingMessage =
      task.message ||
      latestEvent?.message ||
      (task.status === "queued" ? "Task queued." : "Gemini Spark is processing this task.")
    const agentData = taskToAgentResponse(task)
    const isDone = task.status === "succeeded"
    const isError = task.status === "failed" || task.status === "canceled"

    setChatState((current) => {
      const nextSessions = current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      taskId: task.id,
                      body: isDone || isError ? agentData.message : displayBrandText(pendingMessage),
                      status: isDone ? ("done" as const) : isError ? ("error" as const) : ("thinking" as const),
                      provider: isDone ? agentData.provider : undefined,
                      model: isDone ? agentData.model : undefined,
                      intent: agentData.intent,
                      workspaceId: task.workspaceId,
                      events: task.events,
                      media: isDone ? agentData.media : undefined,
                    }
                  : message,
              ),
            }
          : session,
      )

      return {
        ...current,
        sessions: sortSessionsByActivity(nextSessions),
      }
    })
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !event.metaKey) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanDraft = draft.trim()
    if (!cleanDraft || isThinking || !isSignedIn || !isWorkspaceReady || !activeProject?.id || !activeSession?.id) {
      if (isSignedIn && !isWorkspaceReady) {
        void refreshAccount(activeProject?.id, activeSession?.id).catch(() => undefined)
      }
      return
    }

    const submittedAttachments = attachments
    const sessionId = activeSession.id
    const now = Date.now()
    const hasUserMessages = activeSession.messages.some((message) => message.role === "user")
    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      body: cleanDraft,
      attachments: submittedAttachments,
    }
    const thinkingMessage: ChatMessage = {
      id: createId("assistant-thinking"),
      role: "assistant",
      body: thinkingLines[0],
      status: "thinking",
    }

    setChatState((current) => {
      const nextSessions = current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: hasUserMessages ? session.title : makeSessionTitle(cleanDraft, submittedAttachments),
              updatedAt: now,
              messages: [...session.messages, userMessage, thinkingMessage],
            }
          : session,
      )

      return {
        ...current,
        sessions: sortSessionsByActivity(nextSessions),
      }
    })
    setDraft("")
    setAttachments([])
    setAttachmentError("")
    setIsThinking(true)
    let submittedTaskId = ""

    try {
      const response = await fetch(agentApiUrl("/tasks"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: cleanDraft,
          attachments: submittedAttachments.map(({ name, type, dataUrl }) => ({ name, type, dataUrl })),
          projectAgentId: activeProject.id,
          chatThreadId: sessionId,
          sessionId,
          clientTaskId: thinkingMessage.id,
          history: messages
            .filter((message) => message.status !== "thinking")
            .slice(-8)
            .map((message) => ({ role: message.role, body: message.body })),
        }),
      })

      const data = await readJsonBody<AgentTask>(response, "Gemini Spark request returned an invalid response.")

      if (!response.ok) {
        if (response.status === 402) {
          setBillingOpen(true)
          void refreshAccount(activeProject.id, sessionId).catch(() => undefined)
        }

        throw new Error(("error" in data && data.error) || "Agent request failed.")
      }

      if ("error" in data && data.error) {
        throw new Error(data.error)
      }

      const submittedTask = data as AgentTask
      submittedTaskId = submittedTask.id
      resumingTaskIdsRef.current.add(submittedTask.id)
      void refreshAccount(activeProject.id, sessionId).catch(() => undefined)
      const updateFromTask = (task: AgentTask) => applyTaskToAssistantMessage(sessionId, thinkingMessage.id, task)

      updateFromTask(submittedTask)
      const completedTask = await waitForTaskCompletion(submittedTask.id, updateFromTask)

      if (completedTask.status !== "succeeded") {
        throw new Error(completedTask.error || completedTask.message || "Gemini Spark task did not complete.")
      }
    } catch (error) {
      const message = displayBrandText(error instanceof Error ? error.message : "Agent request failed.")

      setChatState((current) => {
        const nextSessions = current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                updatedAt: Date.now(),
                messages: session.messages.map((item) =>
                  item.id === thinkingMessage.id
                    ? {
                        ...item,
                        body: message,
                        status: "error" as const,
                      }
                    : item,
                ),
              }
            : session,
        )

        return {
          ...current,
          sessions: sortSessionsByActivity(nextSessions),
        }
      })
    } finally {
      setIsThinking(false)
      if (submittedTaskId) {
        resumingTaskIdsRef.current.delete(submittedTaskId)
      }
      void refreshAccount(activeProject.id, sessionId).catch(() => undefined)
    }
  }

  return (
    <section className="relative isolate h-dvh min-h-dvh overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-20 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.32 0.02 250 / 0.18) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.32 0.02 250 / 0.14) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[920px] w-[920px] bg-primary/25"
        style={{
          maskImage: "radial-gradient(ellipse 58% 46% at 72% 8%, rgb(0 0 0 / 0.72), transparent)",
        }}
      >
        <div className="absolute inset-0 bg-cover bg-right-top" style={{ backgroundImage: "url('/grade.png')" }} />
      </div>

      <div
        className={cn(
          "relative z-10 grid h-full min-h-0",
          isSessionPanelCollapsed
            ? "lg:grid-cols-[72px_minmax(0,1fr)]"
            : "lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]",
        )}
      >
          <aside
            className={cn(
              "hidden border-r border-border/70 bg-background/82 backdrop-blur-xl lg:flex lg:min-h-0 lg:flex-col",
              isSessionPanelCollapsed ? "lg:items-center lg:p-3.5" : "lg:items-stretch lg:p-4",
            )}
          >
            <div
              className={cn(
                "mb-4 flex items-center justify-between gap-2",
                isSessionPanelCollapsed && "lg:justify-center lg:px-0",
              )}
            >
              <div className={cn("flex min-w-0 items-center gap-2", isSessionPanelCollapsed && "lg:hidden")}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="truncate text-sm font-semibold text-foreground">Gemini Spark</span>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                rounded="lg"
                className={cn("hidden bg-transparent lg:inline-flex", isSessionPanelCollapsed && "lg:size-11")}
                aria-label={isSessionPanelCollapsed ? "Expand sessions sidebar" : "Collapse sessions sidebar"}
                aria-expanded={!isSessionPanelCollapsed}
                aria-controls="gemini-spark-session-list"
                title={isSessionPanelCollapsed ? "Expand sessions" : "Collapse sessions"}
                onClick={() => setIsSessionPanelCollapsed((current) => !current)}
              >
                {isSessionPanelCollapsed ? (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>

            {isSessionPanelCollapsed ? (
              <Button
                size="icon"
                variant="ghost"
                rounded="lg"
                className="mb-3 bg-transparent lg:size-11"
                type="button"
                onClick={() => void startNewProject()}
                title="New project"
                disabled={isCreatingProject || !isSignedIn || !account}
              >
                {isCreatingProject || isAccountLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
              </Button>
            ) : (
              <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/[0.035] p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Projects
                  </p>
                  <button
                    type="button"
                    onClick={() => void startNewProject()}
                    disabled={isCreatingProject || !isSignedIn || !account}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isCreatingProject || isAccountLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    New
                  </button>
                </div>

                <div className="grid gap-1">
                  {isAccountLoading ? (
                    <SidebarLoadingRow collapsed={false} label="Loading projects..." />
                  ) : !account && bootstrapError ? (
                    <SidebarErrorRow collapsed={false} label="Retry required" />
                  ) : (
                    (account?.projects || []).map((project) => {
                      const isActive = activeProject?.id === project.id

                      return (
                        <button
                          key={project.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => switchProject(project.id)}
                          className={cn(
                            "grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition",
                            isActive
                              ? "border-primary/35 bg-background/82 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-background/55 hover:text-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md border",
                              isActive ? "border-primary/35 bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground",
                            )}
                          >
                            <Bot className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold leading-5">{project.name}</span>
                            <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">
                              {project.status.toLowerCase() === "ready" ? "Ready" : "Initializing"}
                            </span>
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {isSessionPanelCollapsed ? (
              <Button
                size="icon"
                variant="ghost"
                rounded="lg"
                className="mb-3 bg-transparent lg:size-11"
                type="button"
                onClick={() => void startNewChat()}
                title="New chat"
                disabled={isCreatingThread || !isSignedIn || !activeProject || isChatNavigationLoading}
              >
                {isCreatingThread || isChatNavigationLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              </Button>
            ) : (
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Chats
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground/70">
                    {isChatNavigationLoading
                      ? "Loading chats..."
                      : isChatNavigationPending
                        ? "Retry required"
                        : activeProject?.name || "No project selected"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startNewChat()}
                  disabled={isCreatingThread || !isSignedIn || !activeProject || isChatNavigationLoading}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isCreatingThread || isChatNavigationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  New
                </button>
              </div>
            )}

            <div
              id="gemini-spark-session-list"
              className={cn(
                "grid min-h-0 flex-1 content-start gap-1 overflow-y-auto border-t border-border/60 pt-2",
                isSessionPanelCollapsed && "lg:w-11 lg:border-t-0 lg:pt-0",
              )}
            >
              {isChatNavigationLoading ? (
                <SidebarLoadingRow collapsed={isSessionPanelCollapsed} label="Loading chats..." />
              ) : isChatNavigationPending ? (
                <SidebarErrorRow collapsed={isSessionPanelCollapsed} label="Retry required" />
              ) : (
                chatState.sessions.map((session) => {
                const SessionIcon = sessionIcon(session)
                const isActive = activeSession.id === session.id

                return (
                  <button
                    key={session.id}
                    type="button"
                    aria-pressed={isActive}
                    title={isSessionPanelCollapsed ? session.title : undefined}
                    onClick={() => selectChatThread(session.id)}
                    className={cn(
                      "grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition",
                      isSessionPanelCollapsed && "lg:size-11 lg:min-h-0 lg:grid-cols-1 lg:place-items-center lg:p-0",
                      isActive
                        ? "border-primary/18 bg-primary/[0.055] text-foreground"
                        : "border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-background/55 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border",
                        isActive
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      <SessionIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className={cn("min-w-0", isSessionPanelCollapsed && "lg:hidden")}>
                      <span className="block truncate text-sm font-medium leading-5">{session.title}</span>
                      <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">{sessionSubtitle(session)}</span>
                    </span>
                  </button>
                )
                })
              )}
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background/72 px-4 backdrop-blur-xl sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Project agent</p>
                  <h1 className="truncate text-sm font-semibold text-foreground">
                    {activeProject?.name || AGENT_BRAND}
                    {isChatNavigationPending ? (
                      <span className="font-normal text-muted-foreground">
                        {" / "}
                        {isChatNavigationLoading ? "Loading chats..." : "Retry required"}
                      </span>
                    ) : activeSession?.title ? (
                      <span className="font-normal text-muted-foreground"> / {activeSession.title}</span>
                    ) : null}
                  </h1>
                </div>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-2">
                {isSignedIn ? (
                  <>
                    <span className="hidden items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary sm:inline-flex">
                      <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                      {account ? `${account.credits.totalCredits} credits` : "Credits..."}
                    </span>
                    <Button size="sm" variant="outline" rounded="full" className="hidden w-fit gap-2 bg-transparent sm:inline-flex" type="button" onClick={() => setBillingOpen(true)}>
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      Upgrade
                    </Button>
                    <span className="hidden max-w-[220px] truncate rounded-full border border-border bg-card/75 px-3 py-1.5 text-xs text-muted-foreground md:inline-block">
                      {session?.user.email || session?.user.name}
                    </span>
                    <Button size="sm" variant="outline" rounded="full" className="hidden w-fit bg-transparent sm:inline-flex" type="button" onClick={signOut}>
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Button size="sm" rounded="full" className="w-fit gap-2" type="button" onClick={signInWithGoogle} disabled={isSessionPending}>
                    <User className="h-4 w-4" aria-hidden="true" />
                    Sign in
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  rounded="lg"
                  className="lg:hidden"
                  type="button"
                  onClick={() => void startNewChat()}
                  title="New chat"
                  disabled={isCreatingThread || !isSignedIn || !activeProject || isChatNavigationLoading}
                >
                  {isCreatingThread || isChatNavigationLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>

            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border/70 bg-background/72 px-4 py-2 lg:hidden">
              {isAccountLoading ? (
                <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background/60 px-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                  Loading projects...
                </span>
              ) : !account && bootstrapError ? (
                <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-destructive/35 bg-destructive/10 px-3 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry required
                </span>
              ) : (
                (account?.projects || []).map((project) => {
                  const isActive = activeProject?.id === project.id

                  return (
                    <button
                      key={project.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => switchProject(project.id)}
                      className={cn(
                        "inline-flex h-9 max-w-40 shrink-0 items-center gap-2 rounded-full border px-3 text-xs transition",
                        isActive
                          ? "border-primary/55 bg-primary/10 text-foreground"
                          : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{project.name}</span>
                    </button>
                  )
                })
              )}
              {isChatNavigationLoading ? (
                <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background/60 px-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                  Loading chats...
                </span>
              ) : isChatNavigationPending ? (
                <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-destructive/35 bg-destructive/10 px-3 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry required
                </span>
              ) : (
                chatState.sessions.map((session) => {
                  const SessionIcon = sessionIcon(session)
                  const isActive = activeSession.id === session.id

                  return (
                    <button
                      key={session.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => selectChatThread(session.id)}
                      className={cn(
                        "inline-flex h-9 max-w-44 shrink-0 items-center gap-2 rounded-full border px-3 text-xs transition",
                        isActive
                          ? "border-primary/55 bg-primary/10 text-foreground"
                          : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <SessionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{session.title}</span>
                    </button>
                  )
                })
              )}
            </div>

            {isWorkspaceBlocked && (
              <WorkspaceInitializationPanel
                state={workspaceState === "failed" ? "failed" : "initializing"}
                workspace={account?.workspace}
                error={bootstrapError}
                onRetry={() => void refreshAccount(activeProject?.id, activeSession?.id).catch(() => undefined)}
              />
            )}

            {projectActionError && (
              <div className="border-b border-border/70 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:px-6">
                {displayBrandText(projectActionError)}
              </div>
            )}

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
                <div
                  className={cn(
                    "mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 py-8",
                    hasConversationStarted ? "justify-start" : "justify-center",
                  )}
                >
                  {isChatNavigationLoading ? (
                    <div className="mx-auto max-w-2xl text-center">
                      <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      </span>
                      <p className="text-2xl font-semibold tracking-display text-foreground sm:text-3xl">
                        Loading your chats
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Restoring the selected project and thread from Gemini Spark.
                      </p>
                    </div>
                  ) : isChatNavigationPending ? (
                    <div className="mx-auto max-w-2xl text-center">
                      <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="text-2xl font-semibold tracking-display text-foreground sm:text-3xl">
                        Chats need attention
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Retry workspace initialization before continuing.
                      </p>
                    </div>
                  ) : !hasConversationStarted && (
                    <div className="mx-auto max-w-2xl text-center">
                      <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="text-2xl font-semibold tracking-display text-foreground sm:text-3xl">
                        Ready when you are
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Ask Gemini Spark for text, image, or video work from a single focused chat.
                      </p>
                    </div>
                  )}

                  {!isChatNavigationPending && visibleMessages.map((message) => {
                    const isUser = message.role === "user"
                    const hasInlineMedia =
                      Boolean(message.media?.urls.length) || Boolean(message.attachments?.length)
                    const hasAssistantDetails =
                      !isUser && (Boolean(message.events?.length) || Boolean(message.workspaceId) || Boolean(message.model))
                    const shouldCenterMessageRow = !isUser && !hasInlineMedia && !hasAssistantDetails

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          isUser
                            ? "items-start justify-end"
                            : shouldCenterMessageRow
                              ? "items-center justify-start"
                              : "items-start justify-start",
                        )}
                      >
                        {!isUser && (
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary",
                              !shouldCenterMessageRow && "mt-1",
                            )}
                          >
                            {message.status === "thinking" ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                            )}
                          </span>
                        )}
                        <div
                          className={cn(
                            "text-sm leading-6",
                            isUser
                              ? "max-w-[78%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                              : message.status === "error"
                                ? "max-w-[82%] rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-foreground"
                                : "max-w-[min(760px,100%)] text-muted-foreground",
                          )}
                        >
                          {message.status === "thinking" ? (
                            <MarkdownMessage content={message.body || thinkingLines[thinkingIndex]} isUser={isUser} />
                          ) : (
                            <MarkdownMessage content={message.body} isUser={isUser} />
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {message.attachments.map((attachment) => (
                                <div key={attachment.id} className="overflow-hidden rounded-lg border border-border">
                                  {attachmentKind(attachment) === "image" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={attachment.dataUrl} alt={attachment.name} className="max-h-44 w-full object-cover" />
                                  ) : (
                                    <video src={attachment.dataUrl} className="max-h-44 w-full object-cover" controls />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {message.provider && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-border bg-card px-2 py-1 text-muted-foreground">
                                {AGENT_BRAND}
                              </span>
                            </div>
                          )}
                          {!isUser && (
                            <OpenClawActivity
                              events={message.events}
                              workspaceId={message.workspaceId}
                              model={message.model}
                              status={message.status}
                            />
                          )}
                          {message.media && (
                            <div className="mt-3 grid max-w-[min(520px,100%)] gap-3">
                              {message.media.urls.map((url) =>
                                message.media?.type === "video" ? (
                                  <video
                                    key={url}
                                    src={url}
                                    className="max-h-[360px] w-auto max-w-full rounded-xl border border-border bg-background object-contain"
                                    controls
                                    onLoadedMetadata={() => scrollMessagesToBottom("smooth")}
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={url}
                                    src={url}
                                    alt="Generated result"
                                    className="max-h-[360px] w-auto max-w-full rounded-xl border border-border bg-background object-contain"
                                    onLoad={() => scrollMessagesToBottom("smooth")}
                                  />
                                ),
                              )}
                            </div>
                          )}
                        </div>
                        {isUser && (
                          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-foreground">
                            <User className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} aria-hidden="true" className="h-1 shrink-0" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-5 pt-3 sm:px-6">
                <div className="mx-auto w-full max-w-4xl">
                  {!isSignedIn && (
                    <div className="mb-3 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>Sign in with Google to start a Gemini Spark chat.</span>
                      <Button type="button" size="sm" rounded="full" className="w-fit" onClick={signInWithGoogle} disabled={isSessionPending}>
                        Sign in
                      </Button>
                    </div>
                  )}

                  {!hasConversationStarted && !isChatNavigationPending && (
                    <div className="mb-3 flex flex-wrap justify-center gap-2">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setDraft(prompt)}
                          disabled={isChatInputDisabled}
                          className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/35 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/70 p-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {attachmentKind(attachment) === "video" ? (
                              <Video className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {attachmentError && <p className="mb-3 text-xs text-destructive">{attachmentError}</p>}

                  <div className="grid gap-2 rounded-2xl border border-border bg-card/88 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.32)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="sr-only"
                      onChange={handleFiles}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      rounded="xl"
                      className="h-11 gap-2 bg-transparent"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isChatInputDisabled}
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                      Attach
                    </Button>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleDraftKeyDown}
                      className="min-h-11 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus-visible:ring-0"
                      placeholder={
                        !isSignedIn
                          ? "Sign in to chat with Gemini Spark..."
                          : isChatNavigationLoading
                            ? "Loading Gemini Spark chats..."
                            : isWorkspaceReady
                            ? "Ask Gemini Spark for text, image, or video work..."
                            : "Gemini Spark workspace is initializing..."
                      }
                      aria-label="Message Gemini Spark"
                      disabled={isChatInputDisabled}
                    />
                    <Button type="submit" rounded="xl" className="h-11 gap-2" disabled={isChatInputDisabled || !draft.trim()}>
                      {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {isThinking ? "Thinking" : "Send"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>

      </div>
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="max-w-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>Upgrade Gemini Spark</DialogTitle>
            <DialogDescription>
              Credits are used for every task. Chat costs 1 credit, images cost 5, and videos cost 10.
            </DialogDescription>
          </DialogHeader>

          <div className="flex w-fit rounded-full border border-border bg-background/60 p-1">
            {(["year", "month"] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => setBillingInterval(interval)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition",
                  billingInterval === interval ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {interval === "year" ? "Yearly" : "Monthly"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["STARTUP", "PRO"] as const).map((plan) => {
              const details = BILLING_PLANS[plan]
              const price = billingInterval === "year" ? details.yearlyPriceUsd : details.monthlyPriceUsd

              return (
                <div key={plan} className="rounded-lg border border-border bg-background/55 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{details.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{details.monthlyCredits} credits each month</p>
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      ${price}/{billingInterval === "year" ? "yr" : "mo"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    rounded="lg"
                    className="w-full gap-2"
                    onClick={() => void startCheckout(plan)}
                    disabled={checkoutPlan !== null}
                  >
                    {checkoutPlan === plan ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
                    Continue
                  </Button>
                </div>
              )
            })}
          </div>

          {account?.credits.plan !== "free" && (
            <Button type="button" variant="outline" rounded="lg" className="w-fit bg-transparent" onClick={() => void openBillingPortal()}>
              Manage billing
            </Button>
          )}

          {billingError && <p className="text-sm text-destructive">{billingError}</p>}
        </DialogContent>
      </Dialog>
    </section>
  )
}
