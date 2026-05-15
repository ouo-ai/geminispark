"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useMemo, useState } from "react"
import { Bot, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const agentModes = ["Research", "Marketing", "Product", "Operations"] as const
type AgentMode = (typeof agentModes)[number]

const starterObjective =
  "Plan a launch workflow for a new AI productivity feature, including research, positioning, content tasks, and review checks."

export function AgentWorkspace() {
  const router = useRouter()
  const [objective, setObjective] = useState(starterObjective)
  const [mode, setMode] = useState<AgentMode>("Research")

  const wordCount = useMemo(() => objective.trim().split(/\s+/).filter(Boolean).length, [objective])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanObjective = objective.trim()
    if (!cleanObjective) {
      return
    }

    const params = new URLSearchParams({
      prompt: cleanObjective,
      mode,
    })

    router.push(`/gemini-spark?${params.toString()}`)
  }

  return (
    <section id="agent-workspace" className="relative border-y border-border/35 bg-secondary/20 py-14 sm:py-18">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Agent workspace
            </div>
            <h2 className="text-3xl font-bold tracking-display text-foreground sm:text-4xl">
              Build an agent brief with <span className="text-gradient-spark">Gemini Spark</span>
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Describe the objective, choose a working mode, and Gemini Spark structures the role, steps, checks, and output for an AI agent task.
            </p>
          </div>

          <div className="flex w-fit items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Agent</p>
              <p className="text-sm font-semibold text-foreground">Gemini Spark</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-card p-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-5"
          >
            <label htmlFor="agent-objective" className="mb-2 block text-sm font-medium text-foreground">
              Agent objective
            </label>
            <Textarea
              id="agent-objective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="min-h-36 resize-none border-border bg-background/60 text-sm leading-6"
              placeholder="Describe the goal, audience, context, and expected result."
              required
            />

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-foreground">Agent mode</label>
              <div className="grid gap-2 sm:grid-cols-4">
                {agentModes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                      mode === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background/55 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                {wordCount} words. Add constraints and expected output for a more useful agent brief.
              </p>
              <Button type="submit" size="lg" rounded="lg" className="w-full gap-2 sm:w-auto" disabled={!objective.trim()}>
                <Wand2 className="h-4 w-4" />
                Build brief
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
