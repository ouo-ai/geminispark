"use client"

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Film, Loader2, Play, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type AspectRatio = "16:9" | "9:16"
type Duration = 4 | 8 | 12 | 16 | 20

type GeminiSparkTask = {
  id: string
  status: string
  progress: number
  modelName: "Gemini Spark"
  videoUrls: string[]
  thumbnailUrl?: string
  estimatedTime?: number
  actualTime?: number
  errorMessage?: string
}

const starterPrompt =
  "A cinematic product reveal of a small AI spark turning a rough notebook sketch into a polished launch video, clean studio lighting, smooth camera move, premium SaaS style."

const terminalStatuses = new Set(["completed", "failed", "cancelled"])

export function VideoGenerator() {
  const [prompt, setPrompt] = useState(starterPrompt)
  const [duration, setDuration] = useState<Duration>(8)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9")
  const [imageUrl, setImageUrl] = useState("")
  const [task, setTask] = useState<GeminiSparkTask | null>(null)
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const videoUrl = task?.videoUrls[0]
  const isTerminal = task ? terminalStatuses.has(task.status) : false
  const isWorking = isSubmitting || (!!task && !isTerminal)
  const messageIsError =
    task?.status === "failed" || /could not|not configured|invalid|failed/i.test(message)

  const progressLabel = useMemo(() => {
    if (!task) {
      return "Ready"
    }

    if (task.status === "completed") {
      return "Completed"
    }

    if (task.status === "failed") {
      return "Failed"
    }

    return `${Math.max(task.progress || 0, task.status === "submitted" ? 1 : 0)}%`
  }, [task])

  const pollTask = useCallback(async (taskId: string) => {
    const response = await fetch(`/api/generate/${encodeURIComponent(taskId)}`, {
      cache: "no-store",
    })
    const payload = await response.json()

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "Could not read the Gemini Spark task status.")
    }

    setTask(payload.task)
    setMessage(payload.task.errorMessage || "")
  }, [])

  useEffect(() => {
    if (!task?.id || terminalStatuses.has(task.status)) {
      return
    }

    const interval = window.setInterval(() => {
      pollTask(task.id).catch((error: Error) => setMessage(error.message))
    }, 5000)

    return () => window.clearInterval(interval)
  }, [pollTask, task?.id, task?.status])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage("")
    setTask(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          duration,
          resolution: "720p",
          aspectRatio,
          imageUrl: imageUrl.trim(),
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Could not start Gemini Spark generation.")
      }

      setTask(payload.task)
      setMessage("Task submitted. Gemini Spark is generating your video.")
      pollTask(payload.task.id).catch(() => undefined)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Gemini Spark generation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="generator" className="relative py-14 sm:py-18 border-y border-border/35 bg-secondary/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Live generation
            </div>
            <h2 className="text-3xl font-bold tracking-display text-foreground sm:text-4xl">
              Create a video with <span className="text-gradient-spark">Gemini Spark</span>
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Submit a prompt, choose format and length, then watch the task move from queued to ready.
            </p>
          </div>

          <div className="flex w-fit items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Film className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Model</p>
              <p className="text-sm font-semibold text-foreground">Gemini Spark</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-card p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-5"
          >
            <label htmlFor="video-prompt" className="mb-2 block text-sm font-medium text-foreground">
              Prompt
            </label>
            <Textarea
              id="video-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-36 resize-none border-border bg-background/60 text-sm leading-6"
              placeholder="Describe the scene, camera movement, subject, mood, and visual style."
              required
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Aspect</label>
                <div className="grid grid-cols-2 rounded-lg border border-border bg-background/60 p-1">
                  {(["16:9", "9:16"] as AspectRatio[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAspectRatio(value)}
                      className={`rounded-md px-3 py-2 text-sm transition ${
                        aspectRatio === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="video-duration" className="mb-2 block text-sm font-medium text-foreground">
                  Duration
                </label>
                <select
                  id="video-duration"
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value) as Duration)}
                  className="h-[42px] w-full rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {[4, 8, 12, 16, 20].map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reference-image" className="mb-2 block text-sm font-medium text-foreground">
                  Reference image
                </label>
                <Input
                  id="reference-image"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  className="h-[42px] border-border bg-background/60 text-sm"
                  placeholder="Optional URL"
                  type="url"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                Public image URLs can guide image-to-video generations. Leave blank for text-to-video.
              </p>
              <Button type="submit" size="lg" rounded="lg" className="w-full gap-2 sm:w-auto" disabled={isWorking}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate video
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Task status</p>
                <p className="text-lg font-semibold capitalize text-foreground">{task?.status || "idle"}</p>
              </div>
              <div className="rounded-full border border-border bg-background/60 px-3 py-1 text-sm text-primary">
                {progressLabel}
              </div>
            </div>

            <div className="mb-4 h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${task?.status === "completed" ? 100 : Math.max(task?.progress || 0, 3)}%` }}
              />
            </div>

            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-background/70">
              {videoUrl ? (
                <video className="h-full w-full object-cover" src={videoUrl} poster={task?.thumbnailUrl} controls />
              ) : (
                <div className="flex flex-col items-center gap-3 px-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {isWorking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                  </span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {isWorking ? "Waiting for the generated video URL." : "Your generated video preview appears here."}
                  </p>
                </div>
              )}
            </div>

            {task?.id && (
              <div className="mt-4 rounded-lg border border-border bg-background/55 p-3">
                <p className="text-xs text-muted-foreground">Task ID</p>
                <p className="mt-1 break-all font-mono text-xs text-foreground">{task.id}</p>
              </div>
            )}

            {message && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  messageIsError
                    ? "border-destructive/35 bg-destructive/10 text-foreground"
                    : "border-border bg-background/55 text-muted-foreground"
                }`}
              >
                {messageIsError ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
                <span>{message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
