"use client"

import { type ChangeEvent, type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  CreditCard,
  ImageIcon,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Video,
  Wallet,
  X,
  Zap,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BILLING_PLANS,
  CREDIT_COSTS,
  isActiveSubscriptionStatus,
  type BillingInterval,
  type PaidPlan,
} from "@/lib/billing-config"
import { authClient } from "@/lib/auth-client"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { GEMINI_SPARK_PENDING_PROMPT_KEY } from "@/lib/gemini-spark-prompt-transfer"
import {
  captureAnalyticsException,
  captureEvent,
  identifyAnalyticsUser,
  resetAnalyticsUser,
} from "@/lib/posthog-client"
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

type ManagementTarget = {
  type: "project" | "thread"
  id: string
  label: string
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
const TASK_EVENT_POLL_FALLBACK_MS = 5_000
const AGENT_BRAND = "Gemini Spark"
const CHAT_STORAGE_KEY_PREFIX = "gemini-spark:chat-sessions:v2"
const SESSION_PANEL_COLLAPSED_KEY = "gemini-spark:session-panel-collapsed:v1"
const SIDEBAR_EXPANDED_PROJECTS_KEY = "gemini-spark:sidebar-expanded-projects:v1"
const SIDEBAR_EXPANDED_THREADS_KEY = "gemini-spark:sidebar-expanded-threads:v1"
const SIDEBAR_VISIBLE_THREADS_DEFAULT = 5
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

const paidPlanOrder = ["STARTUP", "PRO"] as const
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
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

function formatMoney(value: number) {
  return moneyFormatter.format(value)
}

function yearlySavings(plan: PaidPlan) {
  const details = BILLING_PLANS[plan]
  return Math.round((1 - details.yearlyPriceUsd / (details.monthlyPriceUsd * 12)) * 100)
}

function priceForInterval(plan: PaidPlan, interval: BillingInterval) {
  const details = BILLING_PLANS[plan]
  return interval === "year" ? details.yearlyPriceUsd : details.monthlyPriceUsd
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

function readPendingPrompt() {
  if (typeof window === "undefined") {
    return ""
  }

  try {
    return window.sessionStorage.getItem(GEMINI_SPARK_PENDING_PROMPT_KEY)?.trim() || ""
  } catch {
    return ""
  }
}

function clearPendingPrompt() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.removeItem(GEMINI_SPARK_PENDING_PROMPT_KEY)
  } catch {
    // Ignore storage failures.
  }
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

function currentThreadIdFromPath() {
  if (typeof window === "undefined") {
    return null
  }

  const match = window.location.pathname.match(/^\/gemini-spark\/t\/([^/?#]+)/)
  if (!match?.[1]) {
    return null
  }

  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function updateChatThreadUrl(threadId: string, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined") {
    return
  }

  const nextPath = chatThreadPath(threadId, false)
  if (window.location.pathname === nextPath) {
    return
  }

  const nextState = {
    ...window.history.state,
    geminiSparkThreadId: threadId,
  }

  if (mode === "replace") {
    window.history.replaceState(nextState, "", nextPath)
    return
  }

  window.history.pushState(nextState, "", nextPath)
}

function readSessionPanelCollapsed() {
  if (typeof window === "undefined") {
    return false
  }

  return window.localStorage.getItem(SESSION_PANEL_COLLAPSED_KEY) === "true"
}

function readStringSetFromStorage(key: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set()
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === "string"))
    }
  } catch {
    // ignore corrupt storage
  }

  return new Set()
}

function writeStringSetToStorage(key: string, value: Set<string>) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(value)))
  } catch {
    // storage may be unavailable; ignore
  }
}

function projectActivityTimestamp(project: ProjectAgent) {
  return project.updatedAt || project.createdAt
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

function SessionDetectionPanel() {
  return (
    <div className="relative z-10 flex h-full min-h-0 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background/82 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Checking your session</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Confirming whether you are signed in before loading Gemini Spark.
            </p>
          </div>
        </div>
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

async function renameProjectRequest(projectAgentId: string, name: string) {
  const response = await fetch(agentApiUrl(`/projects/${encodeURIComponent(projectAgentId)}`), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  })
  const data = await readJsonBody<{ project?: ProjectAgent }>(response, "Project could not be renamed.")

  if (!response.ok || !data.project) {
    throw new Error(data.error || "Project could not be renamed.")
  }

  return data.project
}

async function deleteProjectRequest(projectAgentId: string) {
  const response = await fetch(agentApiUrl(`/projects/${encodeURIComponent(projectAgentId)}`), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  })
  const data = await readJsonBody<{ project?: ProjectAgent }>(response, "Project could not be deleted.")

  if (!response.ok || !data.project) {
    throw new Error(data.error || "Project could not be deleted.")
  }

  return data.project
}

async function renameThreadRequest(threadId: string, title: string) {
  const response = await fetch(agentApiUrl(`/threads/${encodeURIComponent(threadId)}`), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  })
  const data = await readJsonBody<{ thread?: ChatThread }>(response, "Chat could not be renamed.")

  if (!response.ok || !data.thread) {
    throw new Error(data.error || "Chat could not be renamed.")
  }

  return data.thread
}

async function deleteThreadRequest(threadId: string) {
  const response = await fetch(agentApiUrl(`/threads/${encodeURIComponent(threadId)}`), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  })
  const data = await readJsonBody<{ thread?: ChatThread }>(response, "Chat could not be deleted.")

  if (!response.ok || !data.thread) {
    throw new Error(data.error || "Chat could not be deleted.")
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

    async function pollFallbackOnce() {
      try {
        const task = await fetchTask(taskId)
        onUpdate(task)

        if (isTerminalTask(task)) {
          settle(() => resolve(task))
        }
      } catch {
        // Keep the event stream alive; transient poll failures should not end the task wait.
      }
    }

    const pollInterval = window.setInterval(() => {
      void pollFallbackOnce()
    }, TASK_EVENT_POLL_FALLBACK_MS)

    function settle(callback: () => void) {
      if (settled) {
        return
      }

      settled = true
      source.close()
      window.clearInterval(pollInterval)
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
      if (settled) {
        return
      }

      source.close()
      window.clearInterval(pollInterval)
      pollTaskUntilDone(taskId, onUpdate).then(
        (task) => settle(() => resolve(task)),
        (error) => settle(() => reject(error)),
      )
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

function attachmentAnalytics(attachments: ClientAttachment[]) {
  const kinds = attachments.map(attachmentKind)

  return {
    attachment_count: attachments.length,
    has_attachments: attachments.length > 0,
    image_attachment_count: kinds.filter((kind) => kind === "image").length,
    video_attachment_count: kinds.filter((kind) => kind === "video").length,
  }
}

function taskArtifactAnalytics(task: AgentTask) {
  return {
    artifact_count: task.artifacts?.length ?? 0,
    image_artifact_count: task.artifacts?.filter((artifact) => artifact.kind === "image").length ?? 0,
    video_artifact_count: task.artifacts?.filter((artifact) => artifact.kind === "video").length ?? 0,
    has_media: Boolean(task.media?.urls.length),
    media_type: task.media?.type,
  }
}

function latestAssistantResult(session: ChatSession) {
  return session.messages.findLast((message) => message.role === "assistant" && message.status !== undefined)
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
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<ClientAttachment[]>([])
  const [isSessionPanelCollapsed, setIsSessionPanelCollapsed] = useState(readSessionPanelCollapsed)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [thinkingIndex, setThinkingIndex] = useState(0)
  const [attachmentError, setAttachmentError] = useState("")
  const [account, setAccount] = useState<AccountBootstrap | null>(null)
  const [bootstrapError, setBootstrapError] = useState("")
  const [billingOpen, setBillingOpen] = useState(false)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month")
  const [billingEntrySource, setBillingEntrySource] = useState("chat_billing_dialog")
  const [billingError, setBillingError] = useState("")
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null)
  const [paymentPromptDismissed, setPaymentPromptDismissed] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() =>
    readStringSetFromStorage(SIDEBAR_EXPANDED_PROJECTS_KEY),
  )
  const [expandedThreadProjectIds, setExpandedThreadProjectIds] = useState<Set<string>>(() =>
    readStringSetFromStorage(SIDEBAR_EXPANDED_THREADS_KEY),
  )
  const [threadsByProject, setThreadsByProject] = useState<Record<string, ChatThread[]>>({})
  const [loadingProjectIds, setLoadingProjectIds] = useState<Set<string>>(new Set())
  const [projectActionError, setProjectActionError] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState("")
  const [projectNameError, setProjectNameError] = useState("")
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ManagementTarget | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [renameError, setRenameError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ManagementTarget | null>(null)
  const [isManagingItem, setIsManagingItem] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const hasLoadedUrlPromptRef = useRef(false)
  const resumingTaskIdsRef = useRef<Set<string>>(new Set())
  const paymentPromptImpressionKeyRef = useRef("")
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
  const isAuthPending = isSessionPending || isSigningIn
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
  const isPaidSubscription = isActiveSubscriptionStatus(account?.credits.subscriptionStatus)
  const isFreeUser = account?.credits.plan.toLowerCase() === "free" && !isPaidSubscription
  const totalCredits = account?.credits.totalCredits ?? 0
  const shouldShowPaymentPrompt =
    isSignedIn && Boolean(account) && isFreeUser && !isChatNavigationPending && !paymentPromptDismissed
  const paymentPromptVariant =
    totalCredits <= 0 ? "out_of_credits" : hasConversationStarted ? "active_free_user" : "new_free_user"

  useEffect(() => {
    if (!session?.user.id) {
      return
    }

    identifyAnalyticsUser(session.user.id, {
      email: session.user.email,
      name: session.user.name,
    })
  }, [session?.user.id, session?.user.email, session?.user.name])

  useEffect(() => {
    if (!shouldShowPaymentPrompt || !session?.user.id || !account) {
      return
    }

    const impressionKey = `${session.user.id}:${paymentPromptVariant}:${totalCredits}`
    if (paymentPromptImpressionKeyRef.current === impressionKey) {
      return
    }

    paymentPromptImpressionKeyRef.current = impressionKey
    captureEvent("payment_prompt_viewed", {
      source: "chat_session_composer",
      prompt_variant: paymentPromptVariant,
      credits_plan: account.credits.plan,
      subscription_status: account.credits.subscriptionStatus,
      total_credits: totalCredits,
      has_conversation_started: hasConversationStarted,
      active_project_id: activeProject?.id,
      active_thread_id: activeSession?.id,
    })
  }, [
    account,
    activeProject?.id,
    activeSession?.id,
    hasConversationStarted,
    paymentPromptVariant,
    session?.user.id,
    shouldShowPaymentPrompt,
    totalCredits,
  ])

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

  async function signInWithGoogle(source = "chat") {
    if (isSigningIn) {
      return
    }

    setIsSigningIn(true)
    try {
      captureEvent("sign_in_started", {
        provider: "google",
        source,
        has_draft: Boolean(draft.trim()),
        draft_length: draft.trim().length,
      })
      await authClient.signIn.social({
        provider: "google",
        callbackURL: initialThreadId ? chatThreadPath(initialThreadId) : `/gemini-spark${currentUrlSearch()}`,
      })
    } catch (error) {
      captureAnalyticsException(error, { source, action: "sign_in" })
      captureEvent("sign_in_failed", { provider: "google", source })
      setIsSigningIn(false)
    }
  }

  function signOut() {
    captureEvent("user_signed_out", { source: "chat" })
    resetAnalyticsUser()
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

  async function loadProjectThreads(projectAgentId: string) {
    if (!projectAgentId) {
      return
    }
    setLoadingProjectIds((current) => {
      if (current.has(projectAgentId)) {
        return current
      }
      const next = new Set(current)
      next.add(projectAgentId)
      return next
    })

    try {
      const response = await fetch(agentApiUrl(`/projects/${encodeURIComponent(projectAgentId)}/threads`), {
        headers: { Accept: "application/json" },
      })
      const data = await readJsonBody<{ threads?: ChatThread[] }>(response, "Threads could not be loaded.")
      if (!response.ok) {
        throw new Error(data.error || "Threads could not be loaded.")
      }
      setThreadsByProject((current) => ({
        ...current,
        [projectAgentId]: data.threads || [],
      }))
    } catch (error) {
      captureAnalyticsException(error, { source: "sidebar", action: "load_project_threads", project_agent_id: projectAgentId })
    } finally {
      setLoadingProjectIds((current) => {
        if (!current.has(projectAgentId)) {
          return current
        }
        const next = new Set(current)
        next.delete(projectAgentId)
        return next
      })
    }
  }

  function toggleProjectExpanded(projectId: string) {
    setExpandedProjectIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  function toggleProjectThreadsExpanded(projectId: string) {
    setExpandedThreadProjectIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
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
    captureEvent("subscription_checkout_started", {
      source: billingEntrySource,
      dialog_source: "chat_billing_dialog",
      plan,
      interval: billingInterval,
      price_usd: priceForInterval(plan, billingInterval),
      credits_plan: account?.credits.plan,
    })

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checkoutKind: "subscription", plan, interval: billingInterval }),
      })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout could not be started.")
      }

      window.location.assign(data.url)
    } catch (error) {
      captureAnalyticsException(error, { source: billingEntrySource, action: "subscription_checkout", plan })
      captureEvent("checkout_failed", {
        source: billingEntrySource,
        dialog_source: "chat_billing_dialog",
        checkout_kind: "subscription",
        plan,
      })
      setBillingError(error instanceof Error ? error.message : "Checkout could not be started.")
    } finally {
      setCheckoutPlan(null)
    }
  }

  async function openBillingPortal() {
    setBillingError("")
    captureEvent("billing_portal_opened", { source: "chat_billing_dialog" })

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
      captureAnalyticsException(error, { source: "chat_billing_dialog", action: "billing_portal" })
      captureEvent("billing_portal_failed", { source: "chat_billing_dialog" })
      setBillingError(error instanceof Error ? error.message : "Billing portal could not be opened.")
      openBillingDialog("billing_portal_failed")
    }
  }

  function openBillingDialog(source: string) {
    setBillingEntrySource(source)
    setBillingOpen(true)
    captureEvent("billing_dialog_opened", {
      source,
      dialog_source: "chat_billing_dialog",
      credits_plan: account?.credits.plan,
      total_credits: account?.credits.totalCredits,
    })
  }

  function clickPaymentPrompt() {
    captureEvent("payment_prompt_clicked", {
      source: "chat_session_composer",
      prompt_variant: paymentPromptVariant,
      credits_plan: account?.credits.plan,
      subscription_status: account?.credits.subscriptionStatus,
      total_credits: totalCredits,
      has_conversation_started: hasConversationStarted,
      active_project_id: activeProject?.id,
      active_thread_id: activeSession?.id,
    })
    openBillingDialog("chat_session_payment_prompt")
  }

  function dismissPaymentPrompt() {
    setPaymentPromptDismissed(true)
    captureEvent("payment_prompt_dismissed", {
      source: "chat_session_composer",
      prompt_variant: paymentPromptVariant,
      credits_plan: account?.credits.plan,
      subscription_status: account?.credits.subscriptionStatus,
      total_credits: totalCredits,
      has_conversation_started: hasConversationStarted,
    })
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
    const urlPrompt = shouldApplyUrlPrompt ? params.get("prompt")?.trim() || "" : ""
    const pendingPrompt = shouldApplyUrlPrompt && !urlPrompt ? readPendingPrompt() : ""
    const prompt = urlPrompt || pendingPrompt
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
      captureEvent("prompt_prefill_loaded", {
        source: urlPrompt ? "url" : "landing_storage",
        signed_in: isSignedIn,
        prompt_length: prompt.length,
      })
      if (isSignedIn) {
        clearPendingPrompt()
      }
      if (account?.activeThread.id) {
        updateChatThreadUrl(account.activeThread.id, "replace")
      } else {
        window.history.replaceState(window.history.state, "", window.location.pathname)
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
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(SESSION_PANEL_COLLAPSED_KEY, String(isSessionPanelCollapsed))
  }, [isSessionPanelCollapsed])

  useEffect(() => {
    writeStringSetToStorage(SIDEBAR_EXPANDED_PROJECTS_KEY, expandedProjectIds)
  }, [expandedProjectIds])

  useEffect(() => {
    writeStringSetToStorage(SIDEBAR_EXPANDED_THREADS_KEY, expandedThreadProjectIds)
  }, [expandedThreadProjectIds])

  useEffect(() => {
    if (!account?.activeProject.id) {
      return
    }

    const projectId = account.activeProject.id
    const threads = account.threads
    setThreadsByProject((current) => {
      const existing = current[projectId]
      if (existing && existing.length === threads.length && existing.every((thread, index) => thread.id === threads[index]?.id && thread.updatedAt === threads[index]?.updatedAt)) {
        return current
      }
      return { ...current, [projectId]: threads }
    })
  }, [account?.activeProject.id, account?.threads])

  useEffect(() => {
    if (!isSignedIn) {
      setExpandedProjectIds(new Set())
      setExpandedThreadProjectIds(new Set())
      setThreadsByProject({})
      setLoadingProjectIds(new Set())
    }
  }, [isSignedIn])

  useEffect(() => {
    if (!activeProjectId) {
      return
    }
    setExpandedProjectIds((current) => {
      if (current.has(activeProjectId)) {
        return current
      }
      const next = new Set(current)
      next.add(activeProjectId)
      return next
    })
  }, [activeProjectId])

  useEffect(() => {
    if (!account) {
      return
    }
    const projectIds = new Set(account.projects.map((project) => project.id))
    setExpandedProjectIds((current) => {
      let mutated = false
      const next = new Set<string>()
      current.forEach((id) => {
        if (projectIds.has(id)) {
          next.add(id)
        } else {
          mutated = true
        }
      })
      return mutated ? next : current
    })
    setExpandedThreadProjectIds((current) => {
      let mutated = false
      const next = new Set<string>()
      current.forEach((id) => {
        if (projectIds.has(id)) {
          next.add(id)
        } else {
          mutated = true
        }
      })
      return mutated ? next : current
    })
    setThreadsByProject((current) => {
      let mutated = false
      const next: Record<string, ChatThread[]> = {}
      for (const [id, threads] of Object.entries(current)) {
        if (projectIds.has(id)) {
          next[id] = threads
        } else {
          mutated = true
        }
      }
      return mutated ? next : current
    })
  }, [account])

  useEffect(() => {
    if (!isSignedIn || !account) {
      return
    }
    const activeId = account.activeProject.id
    const targets = Array.from(expandedProjectIds).filter(
      (id) => id !== activeId && !threadsByProject[id] && !loadingProjectIds.has(id),
    )
    if (targets.length === 0) {
      return
    }
    targets.forEach((projectId) => {
      void loadProjectThreads(projectId)
    })
    // loadProjectThreads is stable within render; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedProjectIds, account, isSignedIn])

  useEffect(() => {
    if (!isSignedIn) {
      setAccount(null)
      setBootstrapError("")
      setIsStorageReady(false)
      setLoadedStorageKey(null)
      return
    }

    let cancelled = false
    const startedAt = window.performance.now()
    setBootstrapError("")
    setIsStorageReady(false)
    setLoadedStorageKey(null)
    captureEvent("workspace_bootstrap_started", {
      source: "chat",
      initial_thread_id_present: Boolean(initialThreadId),
    })
    fetchAccountBootstrap(null, initialThreadId)
      .then((nextAccount) => {
        if (!cancelled) {
          setAccount(nextAccount)
          setActiveProjectId(nextAccount.activeProject.id)
          setBootstrapError("")
          captureEvent("workspace_bootstrap_succeeded", {
            source: "chat",
            duration_ms: Math.round(window.performance.now() - startedAt),
            workspace_status: nextAccount.workspace.status,
            project_count: nextAccount.projects.length,
            thread_count: nextAccount.threads.length,
            credits_plan: nextAccount.credits.plan,
            subscription_status: nextAccount.credits.subscriptionStatus,
          })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAccount(null)
          setBootstrapError(displayBrandText(error instanceof Error ? error.message : "Gemini Spark workspace initialization failed."))
          captureAnalyticsException(error, { source: "chat", action: "workspace_bootstrap" })
          captureEvent("workspace_bootstrap_failed", {
            source: "chat",
            duration_ms: Math.round(window.performance.now() - startedAt),
          })
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
      updateChatThreadUrl(activeThreadId, "replace")
    }
  }, [account?.activeThread.id, initialThreadId, isSignedIn])

  useEffect(() => {
    if (!isSignedIn) {
      return
    }

    function handlePopState() {
      const threadId = currentThreadIdFromPath()
      if (!threadId || threadId === activeSession.id) {
        return
      }

      setProjectActionError("")
      setBootstrapError("")
      setIsStorageReady(false)
      void fetchAccountBootstrap(null, threadId)
        .then((nextAccount) => {
          setAccount(nextAccount)
          setActiveProjectId(nextAccount.activeProject.id)
          setBootstrapError("")
        })
        .catch((error) => {
          setAccount(null)
          setBootstrapError(displayBrandText(error instanceof Error ? error.message : "Gemini Spark workspace initialization failed."))
        })
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [activeSession.id, isSignedIn])

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
    let rejectedTypeCount = 0
    let rejectedSizeCount = 0

    for (const file of files.slice(0, 4)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        rejectedTypeCount += 1
        setAttachmentError("Only image and video files are supported.")
        continue
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        rejectedSizeCount += 1
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
    if (accepted.length > 0) {
      captureEvent("attachments_added", {
        source: "chat_composer",
        selected_count: files.length,
        accepted_count: accepted.length,
        rejected_type_count: rejectedTypeCount,
        rejected_size_count: rejectedSizeCount,
        image_count: accepted.filter((attachment) => attachmentKind(attachment) === "image").length,
        video_count: accepted.filter((attachment) => attachmentKind(attachment) === "video").length,
      })
    } else if (rejectedTypeCount || rejectedSizeCount) {
      captureEvent("attachments_rejected", {
        source: "chat_composer",
        selected_count: files.length,
        rejected_type_count: rejectedTypeCount,
        rejected_size_count: rejectedSizeCount,
      })
    }
    event.target.value = ""
  }

  function removeAttachment(id: string) {
    const attachment = attachments.find((item) => item.id === id)
    if (attachment) {
      captureEvent("attachment_removed", {
        source: "chat_composer",
        attachment_kind: attachmentKind(attachment),
      })
    }
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
  }

  async function startNewChat() {
    if (!isSignedIn) {
      void signInWithGoogle("new_chat")
      return
    }

    if (!activeProject?.id || isCreatingThread) {
      return
    }

    setIsMobileNavOpen(false)
    setIsCreatingThread(true)
    setProjectActionError("")
    captureEvent("chat_thread_create_started", {
      source: "sidebar",
      project_agent_id: activeProject.id,
    })

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
      updateChatThreadUrl(thread.id)
      captureEvent("chat_thread_created", {
        source: "sidebar",
        project_agent_id: activeProject.id,
        chat_thread_id: thread.id,
      })
    } catch (error) {
      captureAnalyticsException(error, { source: "sidebar", action: "create_thread" })
      captureEvent("chat_thread_create_failed", {
        source: "sidebar",
        project_agent_id: activeProject.id,
      })
      setProjectActionError(error instanceof Error ? error.message : "Chat could not be created.")
    } finally {
      setIsCreatingThread(false)
    }
  }

  function openNewProjectDialog() {
    if (!isSignedIn) {
      void signInWithGoogle("new_project")
      return
    }

    if (isCreatingProject || !account) {
      return
    }

    setIsMobileNavOpen(false)
    setProjectActionError("")
    setProjectNameError("")
    setProjectNameDraft("")
    setProjectDialogOpen(true)
    captureEvent("project_create_dialog_opened", { source: "sidebar" })
  }

  async function submitNewProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isSignedIn) {
      void signInWithGoogle("new_project_submit")
      return
    }

    const projectName = projectNameDraft.replace(/\s+/g, " ").trim()
    if (!projectName) {
      setProjectNameError("Enter a project name.")
      return
    }

    if (isCreatingProject) {
      return
    }

    setIsCreatingProject(true)
    setProjectActionError("")
    setProjectNameError("")
    captureEvent("project_create_started", {
      source: "sidebar",
      name_length: projectName.length,
    })

    try {
      const { project, thread } = await createProjectRequest(projectName)
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
      setProjectDialogOpen(false)
      setProjectNameDraft("")
      updateChatThreadUrl(thread.id)
      void refreshAccount(project.id, thread.id).catch(() => undefined)
      captureEvent("project_created", {
        source: "sidebar",
        project_agent_id: project.id,
        chat_thread_id: thread.id,
        workspace_status: project.status,
        name_length: projectName.length,
      })
    } catch (error) {
      captureAnalyticsException(error, { source: "sidebar", action: "create_project" })
      captureEvent("project_create_failed", {
        source: "sidebar",
        name_length: projectName.length,
      })
      setProjectNameError(error instanceof Error ? error.message : "Project could not be created.")
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
    captureEvent("project_selected", {
      source: "sidebar",
      project_agent_id: projectId,
    })
    void refreshAccount(projectId, null)
      .then((nextAccount) => {
        updateChatThreadUrl(nextAccount.activeThread.id)
      })
      .catch(() => undefined)
  }

  function selectChatThread(threadId: string, projectAgentId?: string) {
    setProjectActionError("")
    setIsMobileNavOpen(false)
    const targetProjectId = projectAgentId || activeProject?.id
    const switchesProject = Boolean(targetProjectId && targetProjectId !== activeProject?.id)
    captureEvent("chat_thread_selected", {
      source: "sidebar",
      project_agent_id: targetProjectId,
      chat_thread_id: threadId,
      switches_project: switchesProject,
    })
    if (!isCurrentThreadUrl(threadId)) {
      updateChatThreadUrl(threadId)
    }

    if (switchesProject && targetProjectId) {
      setActiveProjectId(targetProjectId)
      setBootstrapError("")
      setIsStorageReady(false)
      void refreshAccount(targetProjectId, threadId).catch(() => undefined)
      return
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

  async function startNewChatInProject(projectId: string) {
    if (!isSignedIn) {
      void signInWithGoogle("new_chat")
      return
    }
    if (!projectId || isCreatingThread) {
      return
    }

    if (projectId === activeProject?.id) {
      await startNewChat()
      return
    }

    setIsMobileNavOpen(false)
    setIsCreatingThread(true)
    setProjectActionError("")
    setBootstrapError("")
    setIsStorageReady(false)
    captureEvent("chat_thread_create_started", {
      source: "sidebar",
      project_agent_id: projectId,
      switches_project: true,
    })

    try {
      const thread = await createThreadRequest(projectId)
      setActiveProjectId(projectId)
      setThreadsByProject((current) => {
        const existing = current[projectId] || []
        return {
          ...current,
          [projectId]: [thread, ...existing.filter((item) => item.id !== thread.id)],
        }
      })
      updateChatThreadUrl(thread.id)
      try {
        await refreshAccount(projectId, thread.id)
      } catch {
        // ignore: thread is created server-side; refresh will retry on next interaction
      }
      setDraft("")
      setAttachments([])
      setAttachmentError("")
      captureEvent("chat_thread_created", {
        source: "sidebar",
        project_agent_id: projectId,
        chat_thread_id: thread.id,
        switches_project: true,
      })
    } catch (error) {
      captureAnalyticsException(error, { source: "sidebar", action: "create_thread_in_project", project_agent_id: projectId })
      captureEvent("chat_thread_create_failed", {
        source: "sidebar",
        project_agent_id: projectId,
        switches_project: true,
      })
      setProjectActionError(error instanceof Error ? error.message : "Chat could not be created.")
    } finally {
      setIsCreatingThread(false)
    }
  }

  function openRenameDialog(target: ManagementTarget) {
    setIsMobileNavOpen(false)
    setRenameTarget(target)
    setRenameDraft(target.label)
    setRenameError("")
    setProjectActionError("")
    captureEvent("management_dialog_opened", {
      source: "sidebar",
      action: "rename",
      target_type: target.type,
    })
  }

  function openDeleteDialog(target: ManagementTarget) {
    setIsMobileNavOpen(false)
    setDeleteTarget(target)
    setProjectActionError("")
    captureEvent("management_dialog_opened", {
      source: "sidebar",
      action: "delete",
      target_type: target.type,
    })
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!renameTarget || isManagingItem) {
      return
    }

    const nextLabel = renameDraft.replace(/\s+/g, " ").trim()
    if (!nextLabel) {
      setRenameError(renameTarget.type === "project" ? "Enter a project name." : "Enter a chat name.")
      return
    }

    setIsManagingItem(true)
    setRenameError("")
    setProjectActionError("")
    captureEvent("management_rename_started", {
      source: "sidebar",
      target_type: renameTarget.type,
      label_length: nextLabel.length,
    })

    try {
      if (renameTarget.type === "project") {
        const project = await renameProjectRequest(renameTarget.id, nextLabel)
        setAccount((current) =>
          current
            ? {
                ...current,
                projects: current.projects.map((item) => (item.id === project.id ? project : item)),
                activeProject: current.activeProject.id === project.id ? project : current.activeProject,
              }
            : current,
        )
      } else {
        const thread = await renameThreadRequest(renameTarget.id, nextLabel)
        setAccount((current) =>
          current
            ? {
                ...current,
                threads: current.threads.map((item) => (item.id === thread.id ? thread : item)),
                activeThread: current.activeThread.id === thread.id ? thread : current.activeThread,
              }
            : current,
        )
        setThreadsByProject((current) => {
          const existing = current[thread.projectAgentId]
          if (!existing) {
            return current
          }
          return {
            ...current,
            [thread.projectAgentId]: existing.map((item) => (item.id === thread.id ? thread : item)),
          }
        })
        setChatState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === thread.id
              ? {
                  ...session,
                  title: thread.title,
                  updatedAt: new Date(thread.updatedAt).getTime(),
                }
              : session,
          ),
        }))
      }

      setRenameTarget(null)
      setRenameDraft("")
      captureEvent("management_renamed", {
        source: "sidebar",
        target_type: renameTarget.type,
      })
    } catch (error) {
      captureAnalyticsException(error, { source: "sidebar", action: "rename", target_type: renameTarget.type })
      captureEvent("management_rename_failed", {
        source: "sidebar",
        target_type: renameTarget.type,
      })
      setRenameError(error instanceof Error ? error.message : "Rename failed.")
    } finally {
      setIsManagingItem(false)
    }
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget || isManagingItem) {
      return
    }

    const target = deleteTarget
    setIsManagingItem(true)
    setProjectActionError("")
    captureEvent("management_delete_started", {
      source: "sidebar",
      target_type: target.type,
    })

    try {
      if (target.type === "project") {
        await deleteProjectRequest(target.id)
        setThreadsByProject((current) => {
          if (!(target.id in current)) {
            return current
          }
          const next = { ...current }
          delete next[target.id]
          return next
        })
        const deletingActiveProject = activeProject?.id === target.id
        setIsStorageReady(false)
        const nextAccount = await refreshAccount(
          deletingActiveProject ? null : activeProject?.id,
          deletingActiveProject ? null : activeSession?.id,
        )
        if (deletingActiveProject) {
          updateChatThreadUrl(nextAccount.activeThread.id, "replace")
        }
      } else {
        await deleteThreadRequest(target.id)
        setThreadsByProject((current) => {
          let mutated = false
          const next: Record<string, ChatThread[]> = {}
          for (const [projectId, threads] of Object.entries(current)) {
            const filtered = threads.filter((thread) => thread.id !== target.id)
            if (filtered.length !== threads.length) {
              mutated = true
              next[projectId] = filtered
            } else {
              next[projectId] = threads
            }
          }
          return mutated ? next : current
        })
        const deletingActiveThread = activeSession?.id === target.id
        setIsStorageReady(false)
        const nextAccount = await refreshAccount(activeProject?.id, deletingActiveThread ? null : activeSession?.id)
        if (deletingActiveThread) {
          updateChatThreadUrl(nextAccount.activeThread.id, "replace")
        }
      }

      setDeleteTarget(null)
      captureEvent("management_deleted", {
        source: "sidebar",
        target_type: target.type,
      })
    } catch (error) {
      captureAnalyticsException(error, { source: "sidebar", action: "delete", target_type: target.type })
      captureEvent("management_delete_failed", {
        source: "sidebar",
        target_type: target.type,
      })
      setProjectActionError(error instanceof Error ? error.message : "Delete failed.")
    } finally {
      setIsManagingItem(false)
    }
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
      const reason = !cleanDraft
        ? "empty_draft"
        : isThinking
          ? "already_thinking"
          : !isSignedIn
            ? "signed_out"
            : !isWorkspaceReady
              ? "workspace_not_ready"
              : !activeProject?.id
                ? "missing_project"
                : "missing_thread"

      captureEvent("chat_submit_blocked", {
        reason,
        signed_in: isSignedIn,
        workspace_state: workspaceState,
        draft_length: cleanDraft.length,
      })
      if (isSignedIn && !isWorkspaceReady) {
        void refreshAccount(activeProject?.id, activeSession?.id).catch(() => undefined)
      }
      return
    }

    const submittedAttachments = attachments
    const sessionId = activeSession.id
    const now = Date.now()
    const startedAt = window.performance.now()
    const hasUserMessages = activeSession.messages.some((message) => message.role === "user")
    const taskRequestAnalytics = {
      project_agent_id: activeProject.id,
      chat_thread_id: sessionId,
      first_message: !hasUserMessages,
      draft_length: cleanDraft.length,
      history_message_count: messages.filter((message) => message.status !== "thinking").length,
      credits_plan: account?.credits.plan,
      total_credits: account?.credits.totalCredits,
      workspace_status: account?.workspace.status,
      ...attachmentAnalytics(submittedAttachments),
    }
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
    captureEvent("chat_message_submitted", taskRequestAnalytics)
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
          openBillingDialog("insufficient_credits")
          void refreshAccount(activeProject.id, sessionId).catch(() => undefined)
        }

        captureEvent("chat_message_rejected", {
          ...taskRequestAnalytics,
          status_code: response.status,
          duration_ms: Math.round(window.performance.now() - startedAt),
        })
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
      captureEvent("agent_task_accepted", {
        ...taskRequestAnalytics,
        task_id: submittedTask.id,
        task_status: submittedTask.status,
        intent: submittedTask.intent,
        credit_cost: submittedTask.creditCost,
      })
      const completedTask = await waitForTaskCompletion(submittedTask.id, updateFromTask)
      captureEvent(completedTask.status === "succeeded" ? "agent_task_completed" : "agent_task_finished_unsuccessfully", {
        ...taskRequestAnalytics,
        ...taskArtifactAnalytics(completedTask),
        task_id: completedTask.id,
        task_status: completedTask.status,
        intent: completedTask.intent,
        credit_cost: completedTask.creditCost,
        duration_ms: Math.round(window.performance.now() - startedAt),
      })

      if (completedTask.status !== "succeeded") {
        throw new Error(completedTask.error || completedTask.message || "Gemini Spark task did not complete.")
      }
    } catch (error) {
      const message = displayBrandText(error instanceof Error ? error.message : "Agent request failed.")
      captureAnalyticsException(error, { source: "chat_composer", action: "agent_task", task_id: submittedTaskId || undefined })
      captureEvent("agent_task_failed", {
        ...taskRequestAnalytics,
        task_id: submittedTaskId || undefined,
        duration_ms: Math.round(window.performance.now() - startedAt),
        error_name: error instanceof Error ? error.name : "UnknownError",
      })

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

  const renderExpandedSidebar = (opts?: { panelId?: string }) => (
    <>
      <div className="mb-3 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => void startNewChat()}
          disabled={isCreatingThread || !isSignedIn || !activeProject || isChatNavigationLoading}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-50"
        >
          {isCreatingThread || isChatNavigationLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          New chat
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Projects</p>
        <button
          type="button"
          onClick={openNewProjectDialog}
          disabled={isCreatingProject || !isSignedIn || !account}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:bg-background/55 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {isCreatingProject || isAccountLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          New
        </button>
      </div>

      <div
        {...(opts?.panelId ? { id: opts.panelId } : {})}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1"
      >
        {isAccountLoading ? (
          <SidebarLoadingRow collapsed={false} label="Loading projects..." />
        ) : !account && bootstrapError ? (
          <SidebarErrorRow collapsed={false} label="Retry required" />
        ) : (account?.projects || []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-4 text-center text-xs text-muted-foreground">
            No projects yet. Click &quot;New&quot; to start.
          </div>
        ) : (
          (account?.projects || []).map((project) => {
            const isActiveProj = activeProject?.id === project.id
            const isExpanded = expandedProjectIds.has(project.id)
            const threadsForProject = isActiveProj
              ? chatState.sessions.map((session) => ({
                  id: session.id,
                  title: session.title,
                  updatedAt: new Date(session.updatedAt).toISOString(),
                  projectAgentId: project.id,
                  createdAt: new Date(session.updatedAt).toISOString(),
                }))
              : threadsByProject[project.id]
            const threadsLoading = !threadsForProject && (loadingProjectIds.has(project.id) || (isActiveProj && isChatNavigationLoading))
            const allThreads = threadsForProject || []
            const showAllThreads = expandedThreadProjectIds.has(project.id)
            const visibleThreads = showAllThreads ? allThreads : allThreads.slice(0, SIDEBAR_VISIBLE_THREADS_DEFAULT)
            const hiddenCount = Math.max(0, allThreads.length - visibleThreads.length)

            return (
              <div key={project.id} className="flex flex-col">
                <div
                  className={cn(
                    "group/proj flex min-h-10 items-center gap-1 rounded-lg pr-1 transition",
                    isActiveProj
                      ? "bg-background/82 text-foreground"
                      : "text-muted-foreground hover:bg-background/55 hover:text-foreground",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-pressed={isActiveProj}
                    onClick={() => {
                      toggleProjectExpanded(project.id)
                      if (!isActiveProj) {
                        switchProject(project.id)
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-2 text-left outline-none"
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
                      aria-hidden="true"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                    <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5">{project.name}</span>
                    {!isExpanded && (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                        {formatRelativeTime(projectActivityTimestamp(project))}
                      </span>
                    )}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 data-[state=open]:opacity-100 lg:h-6 lg:w-6 lg:opacity-0 lg:group-hover/proj:opacity-100"
                        aria-label={`Manage ${project.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onSelect={() => {
                          void startNewChatInProject(project.id)
                        }}
                        disabled={isCreatingThread}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        New chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openRenameDialog({ type: "project", id: project.id, label: project.name })}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => openDeleteDialog({ type: "project", id: project.id, label: project.name })}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isExpanded && (
                  <div className="flex flex-col gap-0.5 pb-1 pl-6">
                    {threadsLoading ? (
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Loading
                      </div>
                    ) : allThreads.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground/70">No chats yet</div>
                    ) : (
                      <>
                        {visibleThreads.map((thread) => {
                          const isActiveThread = isActiveProj && activeSession.id === thread.id
                          return (
                            <div
                              key={thread.id}
                              className={cn(
                                "group/thread flex min-h-9 items-center gap-1 rounded-md pr-1 transition",
                                isActiveThread
                                  ? "bg-primary/[0.075] text-foreground"
                                  : "text-muted-foreground hover:bg-background/55 hover:text-foreground",
                              )}
                            >
                              <button
                                type="button"
                                aria-pressed={isActiveThread}
                                onClick={() => selectChatThread(thread.id, project.id)}
                                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none"
                              >
                                <span className="min-w-0 flex-1 truncate text-[13px] leading-5">
                                  {thread.title || "New chat"}
                                </span>
                                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                                  {formatRelativeTime(thread.updatedAt)}
                                </span>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 data-[state=open]:opacity-100 lg:h-6 lg:w-6 lg:opacity-0 lg:group-hover/thread:opacity-100"
                                    aria-label={`Manage ${thread.title}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden="true" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onSelect={() => openRenameDialog({ type: "thread", id: thread.id, label: thread.title })}>
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => openDeleteDialog({ type: "thread", id: thread.id, label: thread.title })}>
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )
                        })}
                        {hiddenCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleProjectThreadsExpanded(project.id)}
                            className="flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground/80 transition hover:bg-background/55 hover:text-foreground"
                          >
                            <ChevronDown className="h-3 w-3" aria-hidden="true" />
                            Show {hiddenCount} more
                          </button>
                        )}
                        {showAllThreads && allThreads.length > SIDEBAR_VISIBLE_THREADS_DEFAULT && (
                          <button
                            type="button"
                            onClick={() => toggleProjectThreadsExpanded(project.id)}
                            className="flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground/80 transition hover:bg-background/55 hover:text-foreground"
                          >
                            <ChevronRight className="h-3 w-3 rotate-90" aria-hidden="true" />
                            Show less
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )

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

      {isSessionPending ? (
        <SessionDetectionPanel />
      ) : (
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
              <Link
                href="/"
                aria-label="Back to Gemini Spark home"
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                  isSessionPanelCollapsed && "lg:hidden",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="truncate text-sm font-semibold text-foreground">Gemini Spark</span>
              </Link>
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
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  rounded="lg"
                  className="mb-3 bg-transparent lg:size-11"
                  type="button"
                  onClick={openNewProjectDialog}
                  title="New project"
                  disabled={isCreatingProject || !isSignedIn || !account}
                >
                  {isCreatingProject || isAccountLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                </Button>
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
                <div
                  id="gemini-spark-session-list"
                  className="grid min-h-0 w-11 flex-1 content-start gap-1 overflow-y-auto"
                >
                  {isChatNavigationLoading ? (
                    <SidebarLoadingRow collapsed label="Loading chats..." />
                  ) : isChatNavigationPending ? (
                    <SidebarErrorRow collapsed label="Retry required" />
                  ) : (
                    chatState.sessions.map((session) => {
                      const SessionIcon = sessionIcon(session)
                      const isActive = activeSession.id === session.id
                      return (
                        <button
                          key={session.id}
                          type="button"
                          aria-pressed={isActive}
                          title={session.title}
                          onClick={() => selectChatThread(session.id)}
                          className={cn(
                            "grid size-11 min-h-0 grid-cols-1 place-items-center rounded-lg border p-0 text-left transition",
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
                        </button>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              renderExpandedSidebar({ panelId: "gemini-spark-session-list" })
            )}
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/72 px-3 backdrop-blur-xl sm:h-16 sm:gap-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 lg:hidden"
                      aria-label="Open projects and chats menu"
                    >
                      <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="flex w-[88vw] max-w-[360px] flex-col gap-0 border-r border-border/70 bg-background/95 p-0 backdrop-blur-xl sm:max-w-sm">
                    <SheetHeader className="border-b border-border/70 px-4 py-3">
                      <SheetTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                        </span>
                        Gemini Spark
                      </SheetTitle>
                      <SheetDescription className="sr-only">Projects and chats navigation</SheetDescription>
                    </SheetHeader>
                    <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
                      {renderExpandedSidebar()}
                    </div>
                    {isSignedIn && (
                      <div className="shrink-0 border-t border-border/70 bg-background/80 px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Wallet className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">
                                {account ? `${account.credits.totalCredits} credits` : "Loading..."}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {session?.user.email || session?.user.name || ""}
                              </span>
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            rounded="lg"
                            className="shrink-0 gap-1.5"
                            onClick={() => {
                              setIsMobileNavOpen(false)
                              openBillingDialog("mobile_sidebar_upgrade")
                            }}
                          >
                            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                            Upgrade
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMobileNavOpen(false)
                            signOut()
                          }}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-sm text-muted-foreground transition hover:border-border hover:bg-background/80 hover:text-foreground"
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          Sign out
                        </button>
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary sm:flex">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="hidden text-xs text-muted-foreground sm:block">Project agent</p>
                  <h1 className="truncate text-sm font-semibold text-foreground sm:text-sm">
                    <span className="lg:hidden">{activeSession?.title || activeProject?.name || AGENT_BRAND}</span>
                    <span className="hidden lg:inline">
                      {activeProject?.name || AGENT_BRAND}
                      {isChatNavigationPending ? (
                        <span className="font-normal text-muted-foreground">
                          {" / "}
                          {isChatNavigationLoading ? "Loading chats..." : "Retry required"}
                        </span>
                      ) : activeSession?.title ? (
                        <span className="font-normal text-muted-foreground"> / {activeSession.title}</span>
                      ) : null}
                    </span>
                  </h1>
                  <p className="truncate text-[11px] leading-4 text-muted-foreground lg:hidden">
                    {isChatNavigationPending
                      ? (isChatNavigationLoading ? "Loading chats..." : "Retry required")
                      : activeProject?.name || AGENT_BRAND}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-2">
                {isSignedIn ? (
                  <>
                    <span className="hidden items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary sm:inline-flex">
                      <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                      {account ? `${account.credits.totalCredits} credits` : "Credits..."}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      rounded="full"
                      className="hidden w-fit gap-2 bg-transparent sm:inline-flex"
                      type="button"
                      onClick={() => openBillingDialog("top_bar_upgrade")}
                    >
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
                  <Button size="sm" rounded="full" className="w-fit gap-2" type="button" onClick={() => void signInWithGoogle("top_bar")} disabled={isAuthPending}>
                    {isAuthPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <User className="h-4 w-4" aria-hidden="true" />}
                    {isAuthPending ? "Signing in" : "Sign in"}
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

              <form onSubmit={handleSubmit} className="shrink-0 px-3 pt-3 sm:px-6 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
                <div className="mx-auto w-full max-w-4xl">
                  {!isSignedIn && (
                    <div className="mb-3 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>Sign in with Google to start a Gemini Spark chat.</span>
                      <Button type="button" size="sm" rounded="full" className="w-fit gap-2" onClick={() => void signInWithGoogle("composer_gate")} disabled={isAuthPending}>
                        {isAuthPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {isAuthPending ? "Signing in" : "Sign in"}
                      </Button>
                    </div>
                  )}

                  {shouldShowPaymentPrompt && (
                    <div className="mb-3 rounded-xl border border-primary/25 bg-primary/[0.075] p-3 text-sm text-foreground shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/15 text-primary">
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {paymentPromptVariant === "out_of_credits"
                                ? "Free credits are used up"
                                : `${totalCredits} free credit${totalCredits === 1 ? "" : "s"} remaining`}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Upgrade monthly for 1,000 credits across chat, image, and video tasks.
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 sm:self-start">
                          <Button type="button" size="sm" rounded="full" className="gap-2" onClick={clickPaymentPrompt}>
                            Upgrade monthly
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
                            onClick={dismissPaymentPrompt}
                            aria-label="Dismiss upgrade prompt"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasConversationStarted && !isChatNavigationPending && (
                    <div className="mb-3 flex flex-wrap justify-center gap-2">
                      {quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => {
                            setDraft(prompt)
                            captureEvent("quick_prompt_selected", {
                              source: "chat_empty_state",
                              prompt_length: prompt.length,
                              prompt_index: quickPrompts.indexOf(prompt),
                            })
                          }}
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

                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-2xl border border-border bg-card/88 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
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
                      size="icon"
                      className="h-11 w-11 shrink-0 bg-transparent sm:w-auto sm:gap-2 sm:px-4"
                      onClick={() => {
                        captureEvent("attachment_picker_opened", { source: "chat_composer" })
                        fileInputRef.current?.click()
                      }}
                      disabled={isChatInputDisabled}
                      aria-label="Attach file"
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Attach</span>
                    </Button>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleDraftKeyDown}
                      className="min-h-11 resize-none border-0 bg-transparent px-2 py-2 text-base leading-6 shadow-none focus-visible:ring-0 sm:text-sm"
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="submit"
                            rounded="xl"
                            size="icon"
                            className="h-11 w-11 shrink-0 sm:w-auto sm:gap-2 sm:px-4"
                            disabled={isChatInputDisabled || !draft.trim()}
                            aria-label={isThinking ? "Thinking" : "Send"}
                          >
                            {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            <span className="hidden sm:inline">{isThinking ? "Thinking" : "Send"}</span>
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end" sideOffset={8} className="flex items-center gap-2 whitespace-nowrap">
                        <span>Send with</span>
                        <span className="inline-flex items-center gap-1">
                          <Kbd>⌘</Kbd>
                          <Kbd>Enter</Kbd>
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </form>
            </div>
          </div>

        </div>
      )}
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open && !isManagingItem) {
            setRenameTarget(null)
            setRenameDraft("")
            setRenameError("")
          }
        }}
      >
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>{renameTarget?.type === "project" ? "Rename project" : "Rename chat"}</DialogTitle>
            <DialogDescription>
              {renameTarget?.type === "project"
                ? "Update the project name shown in the Gemini Spark sidebar."
                : "Update the chat title shown under the current project."}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitRename}>
            <div className="grid gap-2">
              <label htmlFor="gemini-spark-rename-name" className="text-sm font-medium text-foreground">
                {renameTarget?.type === "project" ? "Project name" : "Chat name"}
              </label>
              <Input
                id="gemini-spark-rename-name"
                value={renameDraft}
                onChange={(event) => {
                  setRenameDraft(event.target.value)
                  setRenameError("")
                }}
                maxLength={80}
                autoFocus
                disabled={isManagingItem}
              />
              {renameError && <p className="text-sm text-destructive">{displayBrandText(renameError)}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                rounded="lg"
                className="bg-transparent"
                onClick={() => {
                  setRenameTarget(null)
                  setRenameDraft("")
                  setRenameError("")
                }}
                disabled={isManagingItem}
              >
                Cancel
              </Button>
              <Button type="submit" rounded="lg" className="gap-2" disabled={isManagingItem || !renameDraft.trim()}>
                {isManagingItem ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isManagingItem) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.type === "project" ? "Delete project?" : "Delete chat?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "project"
                ? `Delete "${deleteTarget.label}" and hide its chat history from the workspace sidebar. Existing task records remain archived for audit.`
                : `Delete "${deleteTarget?.label}" from this project. Existing task records remain archived for audit.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isManagingItem}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteTarget()
              }}
              disabled={isManagingItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isManagingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Create a focused Gemini Spark project with its own workspace and chat threads.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitNewProject}>
            <div className="grid gap-2">
              <label htmlFor="gemini-spark-project-name" className="text-sm font-medium text-foreground">
                Project name
              </label>
              <Input
                id="gemini-spark-project-name"
                value={projectNameDraft}
                onChange={(event) => {
                  setProjectNameDraft(event.target.value)
                  setProjectNameError("")
                }}
                placeholder="Website launch, product research..."
                maxLength={80}
                autoFocus
                disabled={isCreatingProject}
              />
              {projectNameError && <p className="text-sm text-destructive">{displayBrandText(projectNameError)}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                rounded="lg"
                className="bg-transparent"
                onClick={() => setProjectDialogOpen(false)}
                disabled={isCreatingProject}
              >
                Cancel
              </Button>
              <Button type="submit" rounded="lg" className="gap-2" disabled={isCreatingProject || !projectNameDraft.trim()}>
                {isCreatingProject ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                Create project
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={billingOpen}
        onOpenChange={(open) => {
          setBillingOpen(open)
          if (!open) {
            captureEvent("billing_dialog_closed", {
              source: billingEntrySource,
              dialog_source: "chat_billing_dialog",
            })
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[min(94dvh,900px)] w-[calc(100vw-24px)] max-w-none gap-0 overflow-hidden border-white/[0.06] bg-[oklch(0.075_0.006_250)] p-0 shadow-[0_40px_140px_rgb(0_0_0_/_0.78)] sm:w-[min(960px,calc(100vw-40px))] sm:max-w-none"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at 50% 0%, rgb(0,0,0) 30%, transparent 80%)",
            }}
          />
          <DialogClose
            className="absolute right-5 top-5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-muted-foreground transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Close upgrade dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogClose>

          <div className="relative max-h-[min(94dvh,900px)] overflow-y-auto">
            <div className="px-6 pt-8 sm:px-9 sm:pt-10">
              <DialogHeader className="gap-0 text-left">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1 text-xs font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Workspace credits
                </div>
                <DialogTitle className="mt-5 text-4xl font-semibold leading-[1.05] tracking-display text-foreground sm:text-5xl">
                  Upgrade{" "}
                  <span className="font-serif italic font-normal text-[oklch(0.82_0.12_245)]">
                    Gemini Spark
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  One balance powers every task across chat, image, and video — choose the plan that fits how you ship.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 px-6 sm:px-9">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Billing cycle
              </span>
              <div className="flex w-fit rounded-full border border-white/[0.08] bg-white/[0.025] p-1 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]">
                {(["month", "year"] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => {
                      setBillingInterval(interval)
                      captureEvent("billing_interval_selected", {
                        source: "chat_billing_dialog",
                        interval,
                      })
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition",
                      billingInterval === interval
                        ? "bg-white text-[oklch(0.12_0.01_250)] shadow-[0_2px_8px_rgb(0_0_0_/_0.3)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={billingInterval === interval}
                  >
                    {interval === "year" ? "Yearly" : "Monthly"}
                    {interval === "year" && (
                      <span
                        className={cn(
                          "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
                          billingInterval === "year"
                            ? "bg-[oklch(0.55_0.16_150)]/15 text-[oklch(0.78_0.17_150)]"
                            : "bg-[oklch(0.55_0.16_150)]/12 text-[oklch(0.78_0.17_150)]",
                        )}
                      >
                        SAVE {yearlySavings("PRO")}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 px-6 pb-6 sm:px-9 md:grid-cols-2">
              {paidPlanOrder.map((plan) => {
                const details = BILLING_PLANS[plan]
                const monthlyPrice = details.monthlyPriceUsd
                const yearlyPrice = details.yearlyPriceUsd
                const yearlySavingsDollars = monthlyPrice * 12 - yearlyPrice
                const cycleCredits = details.monthlyCredits
                const imageTasks = Math.floor(cycleCredits / CREDIT_COSTS.image)
                const videoTasks = Math.floor(cycleCredits / CREDIT_COSTS["text-to-video"])
                const chatTasks = Math.floor(cycleCredits / CREDIT_COSTS.text)
                const isPro = plan === "PRO"
                const isPending = checkoutPlan === plan
                const priceDisplay = billingInterval === "year"
                  ? Math.round(yearlyPrice / 12)
                  : monthlyPrice

                return (
                  <article
                    key={plan}
                    className={cn(
                      "relative flex flex-col overflow-hidden rounded-xl border bg-white/[0.015] p-6 transition",
                      isPro
                        ? "border-primary/55 shadow-[0_0_0_1px_oklch(0.68_0.19_255_/_0.18),0_24px_80px_-30px_oklch(0.68_0.19_255_/_0.55)]"
                        : "border-white/[0.07]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3
                          className={cn(
                            "text-xs font-semibold uppercase tracking-[0.22em]",
                            isPro ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {details.label}
                        </h3>
                        <p className="mt-3 max-w-[240px] text-sm leading-6 text-muted-foreground">
                          {isPro
                            ? "For teams launching campaigns and shipping at volume."
                            : "For solo builders shipping their first traction."}
                        </p>
                      </div>
                      {isPro && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          <Zap className="h-3 w-3 fill-primary" aria-hidden="true" />
                          Most capacity
                        </span>
                      )}
                    </div>

                    <div className="mt-8 flex items-baseline gap-1">
                      <span className="text-2xl font-medium text-muted-foreground/80">$</span>
                      <span
                        className={cn(
                          "font-serif text-6xl font-normal leading-none tracking-tight",
                          isPro
                            ? "bg-gradient-to-b from-[oklch(0.96_0.02_255)] to-[oklch(0.72_0.18_255)] bg-clip-text text-transparent"
                            : "text-foreground",
                        )}
                      >
                        {priceDisplay}
                      </span>
                      <span className="ml-1 text-sm text-muted-foreground">/ mo</span>
                    </div>

                    <div className="mt-3 min-h-[20px] text-sm text-muted-foreground">
                      {billingInterval === "year" ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-muted-foreground/70 line-through">{formatMoney(monthlyPrice)}</span>
                          <span>Save {formatMoney(yearlySavingsDollars)} a year with annual billing.</span>
                        </span>
                      ) : isPro ? (
                        <span>Save {formatMoney(yearlySavingsDollars)} a year with annual billing.</span>
                      ) : (
                        <span>Billed monthly. Cancel anytime.</span>
                      )}
                    </div>

                    <div
                      className={cn(
                        "mt-6 grid grid-cols-3 gap-2 rounded-lg border p-1",
                        isPro ? "border-primary/20 bg-primary/[0.04]" : "border-white/[0.06] bg-white/[0.015]",
                      )}
                    >
                      <div className="flex flex-col gap-1.5 rounded-md px-3 py-3">
                        <Clock className={cn("h-3.5 w-3.5", isPro ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                        <span className="text-base font-semibold text-foreground">{cycleCredits.toLocaleString()}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Credits / mo</span>
                      </div>
                      <div className="flex flex-col gap-1.5 rounded-md px-3 py-3">
                        <ImageIcon className={cn("h-3.5 w-3.5", isPro ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                        <span className="text-base font-semibold text-foreground">{imageTasks}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Image tasks</span>
                      </div>
                      <div className="flex flex-col gap-1.5 rounded-md px-3 py-3">
                        <Video className={cn("h-3.5 w-3.5", isPro ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                        <span className="text-base font-semibold text-foreground">{videoTasks}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Video tasks</span>
                      </div>
                    </div>

                    <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
                      {isPro ? (
                        <>
                          <li className="inline-flex items-start gap-2.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>
                              Everything in Startup, <span className="font-medium text-foreground">2.5× the capacity</span>
                            </span>
                          </li>
                          <li className="inline-flex items-start gap-2.5">
                            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>
                              <span className="font-medium text-foreground">Priority queue</span> for image & video
                            </span>
                          </li>
                          <li className="inline-flex items-start gap-2.5">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>
                              Shared <span className="font-medium text-foreground">team workspaces</span>
                            </span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="inline-flex items-start gap-2.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>
                              <span className="font-medium text-foreground">Auto-refresh</span> every billing period
                            </span>
                          </li>
                          <li className="inline-flex items-start gap-2.5">
                            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>
                              Up to <span className="font-medium text-foreground">{chatTasks.toLocaleString()} chats</span> from this pool
                            </span>
                          </li>
                          <li className="inline-flex items-start gap-2.5">
                            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>Workspace & Stripe billing</span>
                          </li>
                        </>
                      )}
                    </ul>

                    <Button
                      type="button"
                      variant={isPro ? "default" : "outline"}
                      rounded="lg"
                      className={cn(
                        "mt-7 h-11 w-full gap-2 text-sm font-medium",
                        isPro
                          ? "bg-primary text-primary-foreground shadow-[0_10px_40px_-8px_oklch(0.68_0.19_255_/_0.65)] hover:bg-primary/90"
                          : "border-white/[0.1] bg-transparent hover:border-white/20 hover:bg-white/[0.04]",
                      )}
                      onClick={() => void startCheckout(plan)}
                      disabled={checkoutPlan !== null}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Opening checkout
                        </>
                      ) : (
                        <>
                          Continue with {details.label}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </article>
                )
              })}
            </div>

            <div className="border-t border-white/[0.06] bg-white/[0.01] px-6 py-4 sm:px-9">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                    <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Need a one-off boost? Grab a credit pack.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Available after activating any paid plan.</p>
                  </div>
                </div>
                <Link
                  href="/pricing#credit-packs"
                  className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary transition hover:text-[oklch(0.78_0.18_255)] sm:self-center"
                  onClick={() => {
                    captureEvent("credit_pack_link_clicked", {
                      source: "chat_billing_dialog",
                    })
                  }}
                >
                  View packs
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="border-t border-white/[0.06] px-6 py-4 sm:px-9">
              <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Secured by Stripe
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Cancel anytime
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  30-day refund guarantee
                </span>
              </div>
            </div>

            {((account && account.credits.plan.toLowerCase() !== "free") || billingError) && (
              <div className="flex flex-col gap-3 border-t border-white/[0.06] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9">
                {account && account.credits.plan.toLowerCase() !== "free" && (
                  <Button type="button" variant="outline" rounded="lg" className="w-fit gap-2 border-white/[0.1] bg-transparent" onClick={() => void openBillingPortal()}>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Manage billing
                  </Button>
                )}

                {billingError && (
                  <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                    {billingError}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
