"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { Bot, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const defaultAgentMode = "Research"

const starterObjective =
  "Plan a launch workflow for a new AI productivity feature, including research, positioning, content tasks, and review checks."

export function AgentWorkspace() {
  const router = useRouter()
  const [objective, setObjective] = useState(starterObjective)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanObjective = objective.trim()
    if (!cleanObjective) {
      return
    }

    const params = new URLSearchParams({
      prompt: cleanObjective,
      mode: defaultAgentMode,
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
              Describe the objective and Gemini Spark structures the role, steps, checks, and output for an AI agent task.
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
            className="group relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card/95 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.28)] transition focus-within:border-primary/45 focus-within:shadow-[0_28px_90px_rgba(40,145,255,0.18)] sm:p-2.5"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,oklch(0.68_0.19_255_/_0.14),transparent_32%,oklch(0.76_0.15_285_/_0.08))] opacity-70" />
            <div className="relative flex flex-col gap-2 rounded-[1.55rem] border border-white/5 bg-background/75 p-2 backdrop-blur sm:flex-row sm:items-center">
              <label htmlFor="agent-objective" className="sr-only">
                Agent objective
              </label>
              <Input
                id="agent-objective"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                className="h-14 flex-1 rounded-full border-transparent bg-transparent px-5 text-base text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:border-transparent focus-visible:ring-0"
                placeholder="Describe the agent objective..."
                required
              />
              <Button
                type="submit"
                size="xl"
                rounded="full"
                className="h-[3.25rem] w-full px-6 shadow-[0_16px_36px_rgba(40,145,255,0.24)] sm:w-auto"
                disabled={!objective.trim()}
              >
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
