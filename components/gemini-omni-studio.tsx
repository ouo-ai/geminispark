"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Download,
  History,
  ImageIcon,
  Loader2,
  Play,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Mode = "video" | "image" | "image-edit"
type Duration = "4" | "6" | "8" | "10"
type Resolution = "720p" | "1080p" | "4k"
type VideoAspect = "16:9" | "9:16"
type ImageSize =
  | "1:1"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9"
  | "auto"
type OutputFormat = "png" | "jpeg"
type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled"

type Artifact = {
  id: string
  kind: "text" | "image" | "video" | "other"
  url: string | null
  text: string | null
}

type StudioEvent = {
  id: string
  type: string
  message: string
  createdAt: string
}

type StudioTask = {
  id: string
  status: TaskStatus
  progress: number
  message: string
  error: string | null
  createdAt: string
  finishedAt: string | null
  intent: string
  artifacts: Artifact[]
  events: StudioEvent[]
  media?: { type: "image" | "video"; urls: string[] }
}

const VIDEO_CREDIT_COST = 10
const IMAGE_CREDIT_COST = 5

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "Queued",
  running: "Generating",
  succeeded: "Complete",
  failed: "Failed",
  canceled: "Canceled",
}

const STATUS_TONE: Record<TaskStatus, string> = {
  queued: "bg-muted/60 text-muted-foreground border-border",
  running: "bg-primary/15 text-primary border-primary/30",
  succeeded: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  canceled: "bg-muted/60 text-muted-foreground border-border",
}

const MODES: Array<{
  value: Mode
  label: string
  caption: string
  icon: typeof Play
}> = [
  { value: "video", label: "Video", caption: "Gemini Omni · 4–10s", icon: Play },
  { value: "image", label: "Text to Image", caption: "Nano Banana", icon: ImageIcon },
  { value: "image-edit", label: "Image to Image", caption: "Nano Banana Edit", icon: Wand2 },
]

const VIDEO_PROMPT_EXAMPLES = [
  "A corgi sprinting through a golden wheat field, cinematic dolly shot, warm sunset light, shallow depth of field",
  "Neon-lit Tokyo alley in cyberpunk style, slow rain, reflective puddles, slow camera glide through a crowd",
  "An astronaut bouncing across the lunar surface, Earth rotating in the starry sky, epic long take",
]

const IMAGE_PROMPT_EXAMPLES = [
  "A minimalist product poster of a glass bottle on a marble pedestal, soft studio lighting, pastel palette",
  "Concept art of a forest treehouse village at dusk, lanterns glowing, watercolor and ink style",
  "Editorial portrait of a fashion model in oversized linen, golden hour, 35mm grain",
]

const IMAGE_EDIT_PROMPT_EXAMPLES = [
  "Replace the background with a sunlit Mediterranean coastline, keep the subject identical",
  "Restyle as Studio Ghibli watercolor while preserving facial likeness and composition",
  "Add subtle volumetric mist and warm rim lighting, keep the original camera angle",
]

function mediaUrls(task: StudioTask | null, type: "image" | "video") {
  if (!task) return []
  if (task.media?.type === type && task.media.urls.length > 0) {
    return task.media.urls
  }
  return task.artifacts
    .filter((artifact) => artifact.kind === type && artifact.url)
    .map((artifact) => artifact.url as string)
}

function modeFromTask(task: StudioTask): Mode {
  if (task.intent === "image") return "image"
  return "video"
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("en-US", { hour12: false })
  } catch {
    return value
  }
}

function intentLabel(intent: string) {
  if (intent === "image") return "Image"
  if (intent === "image-to-video") return "Image → Video"
  if (intent === "text-to-video") return "Text → Video"
  return intent
}

export function GeminiOmniStudio() {
  const [mode, setMode] = useState<Mode>("video")
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState<Duration>("8")
  const [resolution, setResolution] = useState<Resolution>("1080p")
  const [videoAspect, setVideoAspect] = useState<VideoAspect>("16:9")
  const [imageSize, setImageSize] = useState<ImageSize>("1:1")
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png")
  const [videoRefUrlsText, setVideoRefUrlsText] = useState("")
  const [editSourceUrlsText, setEditSourceUrlsText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [currentTask, setCurrentTask] = useState<StudioTask | null>(null)
  const [history, setHistory] = useState<StudioTask[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const examples = useMemo(() => {
    if (mode === "image") return IMAGE_PROMPT_EXAMPLES
    if (mode === "image-edit") return IMAGE_EDIT_PROMPT_EXAMPLES
    return VIDEO_PROMPT_EXAMPLES
  }, [mode])

  const creditCost = mode === "video" ? VIDEO_CREDIT_COST : IMAGE_CREDIT_COST

  const parsedRefUrls = useMemo(
    () =>
      videoRefUrlsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [videoRefUrlsText],
  )

  const parsedEditUrls = useMemo(
    () =>
      editSourceUrlsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [editSourceUrlsText],
  )

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/gemini-omni/history", { cache: "no-store" })
      if (!response.ok) {
        return
      }
      const body = (await response.json()) as { items?: StudioTask[] }
      setHistory(Array.isArray(body.items) ? body.items : [])
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const refreshTask = useCallback(async (taskId: string) => {
    const response = await fetch(`/api/gemini-omni/${taskId}`, { cache: "no-store" })
    if (!response.ok) {
      return null
    }
    return (await response.json()) as StudioTask
  }, [])

  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling()
      pollRef.current = setInterval(async () => {
        const next = await refreshTask(taskId)
        if (!next) return
        setCurrentTask(next)
        if (next.status === "succeeded" || next.status === "failed" || next.status === "canceled") {
          stopPolling()
          void loadHistory()
        }
      }, 4000)
    },
    [refreshTask, stopPolling, loadHistory],
  )

  const handleSubmit = useCallback(async () => {
    setSubmitError(null)
    const trimmed = prompt.trim()
    if (!trimmed) {
      setSubmitError("Prompt is required.")
      return
    }

    let imageUrls: string[] = []
    if (mode === "video") {
      imageUrls = parsedRefUrls
      if (imageUrls.length > 7) {
        setSubmitError("At most 7 reference images are allowed.")
        return
      }
    } else if (mode === "image-edit") {
      imageUrls = parsedEditUrls
      if (imageUrls.length === 0) {
        setSubmitError("Image-to-image requires at least one source image URL.")
        return
      }
      if (imageUrls.length > 10) {
        setSubmitError("At most 10 source images are allowed.")
        return
      }
    }

    for (const url of imageUrls) {
      if (!/^https:\/\//i.test(url)) {
        setSubmitError(`Each image URL must start with https:// (invalid: ${url})`)
        return
      }
    }

    const payload: Record<string, unknown> = {
      mode,
      prompt: trimmed,
    }
    if (mode === "video") {
      payload.duration = duration
      payload.aspectRatio = videoAspect
      payload.resolution = resolution
      payload.imageUrls = imageUrls
    } else {
      payload.imageSize = imageSize
      payload.outputFormat = outputFormat
      if (mode === "image-edit") {
        payload.imageUrls = imageUrls
      }
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/gemini-omni/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => null)) as
        | (StudioTask & { error?: string; code?: string; requiredCredits?: number; availableCredits?: number })
        | null
      if (!response.ok || !body) {
        if (response.status === 402 && body?.code === "PAYMENT_REQUIRED") {
          setSubmitError(
            `Not enough credits — needs ${body.requiredCredits ?? creditCost}, you have ${body.availableCredits ?? 0}. Top up on the pricing page.`,
          )
        } else {
          setSubmitError(body?.error || "Submission failed. Please try again.")
        }
        return
      }
      setCurrentTask(body)
      void loadHistory()
      if (body.status !== "succeeded" && body.status !== "failed" && body.status !== "canceled") {
        startPolling(body.id)
      }
    } catch {
      setSubmitError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [
    prompt,
    mode,
    duration,
    videoAspect,
    resolution,
    imageSize,
    outputFormat,
    parsedRefUrls,
    parsedEditUrls,
    creditCost,
    startPolling,
    loadHistory,
  ])

  const handleSelectHistory = useCallback(
    (task: StudioTask) => {
      stopPolling()
      setCurrentTask(task)
      const next = modeFromTask(task)
      setMode(next)
      if (task.status === "queued" || task.status === "running") {
        startPolling(task.id)
      }
    },
    [stopPolling, startPolling],
  )

  const currentVideoUrls = mediaUrls(currentTask, "video")
  const currentImageUrls = mediaUrls(currentTask, "image")
  const isBusy = currentTask?.status === "queued" || currentTask?.status === "running"

  return (
    <section className="relative isolate overflow-hidden pb-24 pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 36rem at 50% -10%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 60%), radial-gradient(40rem 28rem at 90% 10%, color-mix(in oklch, var(--accent) 12%, transparent), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-20 -z-10 mx-auto h-px max-w-6xl"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 50%, transparent), transparent)",
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">Generation Studio</span>
            <span className="text-muted-foreground">·</span>
            <span>powered by kie.ai</span>
          </div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Turn a prompt into{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              video or image
            </span>{" "}
            in seconds.
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pick a mode, describe what you want, ship. Gemini Omni for video, Nano Banana for image. Failed runs auto-refund credits.
          </p>
        </header>

        <div className="mb-6 space-y-2">
          <div
            role="tablist"
            aria-label="Generation mode"
            className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card/70 p-1 backdrop-blur sm:w-auto"
          >
            {MODES.map(({ value, label, icon: Icon }) => {
              const active = mode === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(value)}
                  className={cn(
                    "relative isolate inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="studio-mode-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_4px_16px_-4px] shadow-primary/40"
                    />
                  )}
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex h-4 items-center px-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-muted-foreground"
              >
                {MODES.find((m) => m.value === mode)?.caption}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* FORM CARD */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur">
            <div className="border-b border-border/80 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>
                  {mode === "video"
                    ? "New video task"
                    : mode === "image"
                      ? "New image task"
                      : "New image edit task"}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="studio-prompt" className="text-sm">
                    Prompt
                  </Label>
                  <span className="text-xs text-muted-foreground">{prompt.length}/5000</span>
                </div>
                <Textarea
                  id="studio-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe the scene, subject, camera, lighting, style…"
                  className="min-h-36 resize-y border-border/80 bg-background/60 text-sm leading-relaxed focus-visible:ring-primary/40"
                  maxLength={5000}
                />
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground">Try:</span>
                  {examples.map((example, index) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setPrompt(example)}
                      title={example}
                      className="rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      Example {index + 1}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "video" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SettingField label="Duration">
                      <Select value={duration} onValueChange={(value) => setDuration(value as Duration)}>
                        <SelectTrigger className="bg-background/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4 seconds</SelectItem>
                          <SelectItem value="6">6 seconds</SelectItem>
                          <SelectItem value="8">8 seconds</SelectItem>
                          <SelectItem value="10">10 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingField>
                    <SettingField label="Resolution">
                      <Select value={resolution} onValueChange={(value) => setResolution(value as Resolution)}>
                        <SelectTrigger className="bg-background/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="720p">720p</SelectItem>
                          <SelectItem value="1080p">1080p</SelectItem>
                          <SelectItem value="4k">4K</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingField>
                    <SettingField label="Aspect">
                      <Select value={videoAspect} onValueChange={(value) => setVideoAspect(value as VideoAspect)}>
                        <SelectTrigger className="bg-background/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9 landscape</SelectItem>
                          <SelectItem value="9:16">9:16 portrait</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingField>
                  </div>

                  <details className="group rounded-lg border border-border/80 bg-background/40">
                    <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm text-muted-foreground transition group-open:text-foreground">
                      <span>Reference images (optional)</span>
                      <span className="text-xs text-muted-foreground">
                        {parsedRefUrls.length > 0 ? `${parsedRefUrls.length}/7` : "0/7"}
                      </span>
                    </summary>
                    <div className="space-y-2 border-t border-border/60 px-3 py-3">
                      <Textarea
                        value={videoRefUrlsText}
                        onChange={(event) => setVideoRefUrlsText(event.target.value)}
                        placeholder={"https://...\nhttps://...\n(one URL per line)"}
                        className="min-h-20 resize-y bg-background/60 font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Only public https:// URLs are accepted for now.
                      </p>
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SettingField label="Image size">
                      <Select value={imageSize} onValueChange={(value) => setImageSize(value as ImageSize)}>
                        <SelectTrigger className="bg-background/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1:1">1:1 square</SelectItem>
                          <SelectItem value="16:9">16:9 landscape</SelectItem>
                          <SelectItem value="9:16">9:16 portrait</SelectItem>
                          <SelectItem value="3:4">3:4</SelectItem>
                          <SelectItem value="4:3">4:3</SelectItem>
                          <SelectItem value="3:2">3:2</SelectItem>
                          <SelectItem value="2:3">2:3</SelectItem>
                          <SelectItem value="5:4">5:4</SelectItem>
                          <SelectItem value="4:5">4:5</SelectItem>
                          <SelectItem value="21:9">21:9 cinematic</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingField>
                    <SettingField label="Format">
                      <Select value={outputFormat} onValueChange={(value) => setOutputFormat(value as OutputFormat)}>
                        <SelectTrigger className="bg-background/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="jpeg">JPEG</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingField>
                  </div>

                  {mode === "image-edit" && (
                    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Source images</Label>
                        <span className="text-xs text-muted-foreground">{parsedEditUrls.length}/10</span>
                      </div>
                      <Textarea
                        value={editSourceUrlsText}
                        onChange={(event) => setEditSourceUrlsText(event.target.value)}
                        placeholder={"https://...\nhttps://...\n(one URL per line, 1 to 10)"}
                        className="min-h-20 resize-y bg-background/60 font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Required for image-to-image. Public https:// URLs only.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{creditCost}</span>
                    <span className="text-muted-foreground">credits</span>
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !prompt.trim()}
                  size="lg"
                  className="min-w-36 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {submitError}
                </div>
              )}
            </div>
          </div>

          {/* OUTPUT CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Play className="h-3.5 w-3.5 text-accent" />
                <span>Result</span>
              </div>
              {currentTask && (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    STATUS_TONE[currentTask.status],
                  )}
                >
                  {STATUS_LABELS[currentTask.status]}
                </span>
              )}
            </div>

            <div className="p-5">
              {!currentTask ? (
                <EmptyOutput mode={mode} />
              ) : (
                <div className="space-y-4">
                  {isBusy && (
                    <div className="space-y-1.5">
                      <Progress value={currentTask.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">
                        {currentTask.message || STATUS_LABELS[currentTask.status]}
                      </p>
                    </div>
                  )}

                  {currentTask.error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      {currentTask.error}
                    </div>
                  )}

                  {currentVideoUrls.length > 0 && (
                    <div className="space-y-3">
                      {currentVideoUrls.map((url) => (
                        <MediaTile key={url} url={url} kind="video" />
                      ))}
                    </div>
                  )}

                  {currentImageUrls.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {currentImageUrls.map((url) => (
                        <MediaTile key={url} url={url} kind="image" />
                      ))}
                    </div>
                  )}

                  {!isBusy && currentVideoUrls.length === 0 && currentImageUrls.length === 0 && !currentTask.error && (
                    <p className="text-sm text-muted-foreground">No media returned.</p>
                  )}

                  <details className="rounded-lg border border-border/70 bg-background/40">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
                      Event log ({currentTask.events.length})
                    </summary>
                    <ul className="max-h-48 divide-y divide-border/60 overflow-y-auto text-xs">
                      {currentTask.events.map((event) => (
                        <li key={event.id} className="px-3 py-2">
                          <p className="font-medium text-foreground">{event.message}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            {event.type} · {formatTime(event.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HISTORY STRIP */}
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent runs
              {history.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({history.length})</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void loadHistory()} disabled={historyLoading}>
              {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
              No runs yet. Submit your first generation above.
            </div>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {history.map((task) => {
                const videoUrl = mediaUrls(task, "video")[0]
                const imageUrl = mediaUrls(task, "image")[0]
                const active = currentTask?.id === task.id
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleSelectHistory(task)}
                    className={cn(
                      "group flex w-48 shrink-0 flex-col gap-2 rounded-xl border bg-card/60 p-2 text-left transition",
                      active
                        ? "border-primary/60 ring-1 ring-primary/40"
                        : "border-border hover:border-border/80 hover:bg-card",
                    )}
                  >
                    <div className="aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-black">
                      {videoUrl ? (
                        <video src={videoUrl} muted playsInline className="h-full w-full object-cover" />
                      ) : imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          {task.status === "running" || task.status === "queued"
                            ? "Working…"
                            : task.status === "failed"
                              ? "Failed"
                              : "No preview"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-medium text-foreground">{task.message || "(no prompt)"}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{intentLabel(task.intent)}</span>
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[10px]",
                            STATUS_TONE[task.status],
                          )}
                        >
                          {STATUS_LABELS[task.status]}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SettingField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function EmptyOutput({ mode }: { mode: Mode }) {
  const copy =
    mode === "video"
      ? "Submit a prompt — your generated video will play here."
      : mode === "image-edit"
        ? "Paste source images and a prompt — edited results show here."
        : "Submit a prompt — generated images appear here."
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-gradient-to-br from-background/40 via-background/20 to-background/40">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--primary) 30%, transparent), transparent 70%)",
          }}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-card/80 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>
      <p className="max-w-xs text-center text-sm text-muted-foreground">{copy}</p>
    </div>
  )
}

function MediaTile({ url, kind }: { url: string; kind: "image" | "video" }) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-black">
      {kind === "video" ? (
        <video src={url} controls className="block h-auto w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Generated" className="block h-auto w-full" />
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/80 px-3 py-2 text-xs">
        <span className="truncate text-muted-foreground" title={url}>
          {url}
        </span>
        <a
          href={url}
          download
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 font-medium text-foreground transition hover:border-primary/50 hover:text-primary"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
      </div>
    </div>
  )
}
