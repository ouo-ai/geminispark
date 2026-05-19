"use client"

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ArrowRight,
  Bot,
  ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  User,
  Video,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
  role: "assistant" | "user"
  body: string
  status?: "thinking" | "done" | "error"
  provider?: string
  model?: string
  intent?: string
  media?: AgentMedia
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
  intent: string
  status: AgentTaskStatus
  progress: number
  provider?: string | null
  model?: string | null
  message?: string | null
  error?: string | null
  media?: AgentMedia
  artifacts?: AgentTaskArtifact[]
  events?: AgentTaskEvent[]
}

const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024
const MAX_PERSISTED_ATTACHMENT_BYTES = 400_000
const MAX_PERSISTED_SESSIONS = 30
const MAX_PERSISTED_MESSAGES = 120
const AGENT_BRAND = "Gemini Spark"
const CHAT_STORAGE_KEY = "gemini-spark:chat-sessions:v1"
const CLIENT_ID_STORAGE_KEY = "gemini-spark:client-id:v1"
const CLIENT_OWNER_HEADER = "x-geminispark-client-id"
const AGENT_API_BASE_URL = (process.env.NEXT_PUBLIC_AGENT_API_URL || "").replace(/\/$/, "")
const WELCOME_MESSAGE =
  "Send text, attach an image, or ask for a video. I will think first, choose the best Gemini Spark route, then run the request from the server."

const quickPrompts = [
  "Create a cinematic product video from this idea.",
  "Generate a 16:9 image concept for this campaign.",
  "Turn this into a concise agent plan.",
]

const thinkingLines = [
  "Thinking through the request...",
  "Reading the conversation context...",
  "Checking whether this should be text, image, or video...",
  "Looking for the strongest Gemini Spark route...",
  "Comparing Gemini Spark text, image, and video paths...",
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
  if (!AGENT_API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_AGENT_API_URL is not configured.")
  }

  return `${AGENT_API_BASE_URL}${path}`
}

function createClientOwnerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `browser-${crypto.randomUUID()}`
  }

  return `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getClientOwnerId() {
  if (typeof window === "undefined") {
    return createClientOwnerId()
  }

  try {
    const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim()
    if (existing) {
      return existing
    }

    const next = createClientOwnerId()
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, next)
    return next
  } catch {
    return createClientOwnerId()
  }
}

function latestTaskEvent(task: AgentTask) {
  return task.events?.[task.events.length - 1]
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
    model: task.model || AGENT_BRAND,
    message,
    taskId: task.id,
    media: task.media,
  }
}

async function fetchTask(taskId: string, ownerId: string) {
  const response = await fetch(agentApiUrl(`/tasks/${encodeURIComponent(taskId)}`), {
    headers: {
      Accept: "application/json",
      [CLIENT_OWNER_HEADER]: ownerId,
    },
  })
  const data = (await response.json()) as AgentTask | { error?: string }

  if (!response.ok) {
    throw new Error(("error" in data && data.error) || "Task request failed.")
  }

  return data as AgentTask
}

function isTerminalTask(task: AgentTask) {
  return task.status === "succeeded" || task.status === "failed" || task.status === "canceled"
}

async function pollTaskUntilDone(taskId: string, ownerId: string, onUpdate: (task: AgentTask) => void) {
  for (;;) {
    const task = await fetchTask(taskId, ownerId)
    onUpdate(task)

    if (isTerminalTask(task)) {
      return task
    }

    await wait(2_000)
  }
}

async function waitForTaskCompletion(taskId: string, ownerId: string, onUpdate: (task: AgentTask) => void) {
  if (typeof EventSource === "undefined") {
    return pollTaskUntilDone(taskId, ownerId, onUpdate)
  }

  return new Promise<AgentTask>((resolve, reject) => {
    let settled = false
    const source = new EventSource(
      agentApiUrl(`/tasks/${encodeURIComponent(taskId)}/events?clientId=${encodeURIComponent(ownerId)}`),
    )

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
      pollTaskUntilDone(taskId, ownerId, onUpdate).then(resolve, reject)
    })
  })
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createChatSession(): ChatSession {
  const now = Date.now()
  const id = createId("session")

  return {
    id,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createId("assistant"),
        role: "assistant",
        body: WELCOME_MESSAGE,
      },
    ],
  }
}

function createInitialChatState(): ChatState {
  const initialSession = createChatSession()

  return {
    activeSessionId: initialSession.id,
    sessions: [initialSession],
  }
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
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
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
    body: item.body,
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

function loadStoredSnapshot(): { chatState: ChatState; draft: string } | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
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

    if (parsed.version !== 1 || sessions.length === 0) {
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

function saveStoredSnapshot(chatState: ChatState, draft: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
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
    const session = {
      ...createChatSession(),
      title: makeSessionTitle(prompt, []),
      updatedAt: Date.now(),
    }

    return {
      chatState: {
        activeSessionId: session.id,
        sessions: sortSessionsByActivity([session, ...state.sessions]),
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

export function GeminiSparkChat() {
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<ClientAttachment[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [thinkingIndex, setThinkingIndex] = useState(0)
  const [attachmentError, setAttachmentError] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasLoadedUrlPromptRef = useRef(false)
  const [chatState, setChatState] = useState<ChatState>(() => createInitialChatState())

  const activeSession =
    chatState.sessions.find((session) => session.id === chatState.activeSessionId) ?? chatState.sessions[0]
  const messages = activeSession.messages

  useEffect(() => {
    if (hasLoadedUrlPromptRef.current) {
      return
    }

    hasLoadedUrlPromptRef.current = true

    const stored = loadStoredSnapshot()
    const params = new URLSearchParams(window.location.search)
    const prompt = params.get("prompt")?.trim()
    let nextChatState = stored?.chatState ?? createInitialChatState()
    let nextDraft = stored?.draft ?? ""

    if (prompt) {
      const applied = applyUrlPromptToChatState(nextChatState, prompt)
      nextChatState = applied.chatState
      nextDraft = applied.draft
      window.history.replaceState(null, "", window.location.pathname)
    }

    setChatState(nextChatState)
    setDraft(nextDraft)
    setIsStorageReady(true)
  }, [])

  useEffect(() => {
    if (!isStorageReady) {
      return
    }

    const timeout = window.setTimeout(() => {
      saveStoredSnapshot(chatState, draft)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [chatState, draft, isStorageReady])

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

  function startNewChat() {
    const session = createChatSession()

    setChatState((current) => {
      const completedSessions = current.sessions.filter((item) =>
        item.messages.some((message) => message.role === "user"),
      )

      return {
        activeSessionId: session.id,
        sessions: [session, ...completedSessions],
      }
    })
    setDraft("")
    setAttachments([])
    setAttachmentError("")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanDraft = draft.trim()
    if (!cleanDraft || isThinking) {
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

    try {
      const ownerId = getClientOwnerId()
      const response = await fetch(agentApiUrl("/tasks"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          [CLIENT_OWNER_HEADER]: ownerId,
        },
        body: JSON.stringify({
          message: cleanDraft,
          attachments: submittedAttachments.map(({ name, type, dataUrl }) => ({ name, type, dataUrl })),
          sessionId,
          clientTaskId: thinkingMessage.id,
          externalUserId: ownerId,
          history: messages
            .filter((message) => message.status !== "thinking")
            .slice(-8)
            .map((message) => ({ role: message.role, body: message.body })),
        }),
      })

      const data = (await response.json()) as AgentTask | { error?: string }

      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Agent request failed.")
      }

      if ("error" in data && data.error) {
        throw new Error(data.error)
      }

      const submittedTask = data as AgentTask
      const updateFromTask = (task: AgentTask) => {
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
                    message.id === thinkingMessage.id
                      ? {
                          ...message,
                          body: isDone || isError ? agentData.message : pendingMessage,
                          status: isDone ? ("done" as const) : isError ? ("error" as const) : ("thinking" as const),
                          provider: isDone ? agentData.provider : undefined,
                          model: isDone ? agentData.model : undefined,
                          intent: agentData.intent,
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

      updateFromTask(submittedTask)
      const completedTask = await waitForTaskCompletion(submittedTask.id, ownerId, updateFromTask)

      if (completedTask.status !== "succeeded") {
        throw new Error(completedTask.error || completedTask.message || "Gemini Spark task did not complete.")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent request failed."

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
    }
  }

  return (
    <section className="relative isolate min-h-dvh overflow-hidden bg-background pt-24 lg:h-dvh lg:pt-20">
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

      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-none flex-col px-3 pb-3 pt-4 sm:px-5 lg:h-[calc(100dvh-5rem)] lg:min-h-0 lg:px-6 xl:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Gemini Spark</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-primary">Fused agent chat</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-display text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
              Gemini Spark Chat
            </h1>
          </div>
          <Button size="sm" rounded="full" className="w-fit gap-2" type="button" onClick={startNewChat}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New chat
          </Button>
        </div>

        <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-border bg-card/70 p-3 lg:h-full lg:min-h-0 lg:overflow-hidden xl:p-4">
            <div className="mb-3 flex items-center justify-between px-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Sessions</p>
              <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {chatState.sessions.map((session) => {
                const SessionIcon = sessionIcon(session)
                const isActive = activeSession.id === session.id

                return (
                  <button
                    key={session.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      setChatState((current) => ({
                        ...current,
                        activeSessionId: session.id,
                      }))
                    }
                    className={cn(
                      "grid min-h-20 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                      isActive
                        ? "border-primary/55 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(245,180,50,0.16)]"
                        : "border-transparent bg-background/40 text-muted-foreground hover:border-border hover:bg-background/75 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-md border",
                        isActive
                          ? "border-primary/35 bg-primary/15 text-primary"
                          : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      <SessionIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{session.title}</span>
                      <span className="mt-1 block truncate text-xs leading-5">{sessionSubtitle(session)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="flex min-h-[680px] flex-col rounded-xl border border-border bg-card/80 shadow-[0_34px_120px_rgba(0,0,0,0.38)] lg:h-full lg:min-h-0">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5 xl:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Active fused agent</p>
                  <h2 className="text-sm font-semibold text-foreground">{activeSession.title}</h2>
                </div>
              </div>
              <span className="hidden rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent sm:block">
                Gemini Spark
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5 xl:px-6">
              {messages.map((message) => {
                const isUser = message.role === "user"

                return (
                  <div
                    key={message.id}
                    className={cn("flex items-start gap-3", isUser ? "justify-end" : "justify-start")}
                  >
                    {!isUser && (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                        {message.status === "thinking" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[82%] rounded-xl border px-4 py-3 text-sm leading-6",
                        isUser
                          ? "border-primary/35 bg-primary text-primary-foreground"
                          : message.status === "error"
                            ? "border-destructive/40 bg-destructive/10 text-foreground"
                            : "border-border bg-background/65 text-muted-foreground",
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
                      {message.media && (
                        <div className="mt-3 grid gap-3">
                          {message.media.urls.map((url) =>
                            message.media?.type === "video" ? (
                              <video key={url} src={url} className="w-full rounded-lg border border-border" controls />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={url} src={url} alt="Generated result" className="w-full rounded-lg border border-border" />
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
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border p-3 sm:p-4 xl:p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setDraft(prompt)}
                    disabled={isThinking}
                    className="rounded-full border border-border bg-background/55 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/35 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {attachments.length > 0 && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/55 p-2">
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

              <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
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
                  variant="outline"
                  rounded="lg"
                  className="h-12 gap-2 bg-transparent"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isThinking}
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                  Attach
                </Button>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-24 resize-none border-border bg-background/65 text-sm leading-6"
                  placeholder="Ask for text, image, or video. Gemini Spark will route automatically..."
                  aria-label="Message Gemini Spark"
                  disabled={isThinking}
                />
                <Button type="submit" rounded="lg" className="h-12 gap-2" disabled={isThinking || !draft.trim()}>
                  {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isThinking ? "Thinking" : "Send"}
                </Button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </section>
  )
}
