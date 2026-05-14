"use client"

import { type FormEvent, useMemo, useState } from "react"
import { Bot, CheckCircle2, ClipboardList, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type AgentMode = "Research" | "Marketing" | "Product" | "Operations"

type AgentBrief = {
  role: string
  objective: string
  steps: string[]
  checks: string[]
  output: string
}

const starterObjective =
  "Plan a launch workflow for a new AI productivity feature, including research, positioning, content tasks, and review checks."

const modeConfig: Record<AgentMode, { role: string; output: string; steps: string[]; checks: string[] }> = {
  Research: {
    role: "Research analyst agent",
    output: "Evidence map, findings summary, caveats, and next research questions",
    steps: [
      "Clarify the decision the research should support.",
      "List source inputs and mark missing context.",
      "Cluster findings into themes before writing the summary.",
      "Separate evidence-backed conclusions from assumptions.",
    ],
    checks: [
      "Does every conclusion connect to evidence or a labeled assumption?",
      "Are caveats and missing sources visible?",
      "Can a stakeholder act on the next questions?",
    ],
  },
  Marketing: {
    role: "Marketing strategist agent",
    output: "Campaign angle matrix, message hierarchy, channel tasks, and review notes",
    steps: [
      "Define the audience, offer, and campaign objective.",
      "Turn the objective into three messaging angles.",
      "Map each angle to channels, assets, and review needs.",
      "Flag claims that require human approval.",
    ],
    checks: [
      "Is each angle tied to a specific audience pain point?",
      "Are claims separated from suggestions?",
      "Does the output include a practical next action?",
    ],
  },
  Product: {
    role: "Product operator agent",
    output: "Feature brief, risks, dependencies, launch checklist, and acceptance criteria",
    steps: [
      "State the product decision and user problem.",
      "Summarize context, constraints, and known risks.",
      "Break the work into discovery, build, launch, and review tasks.",
      "Define acceptance criteria for the final handoff.",
    ],
    checks: [
      "Does the brief answer the product decision?",
      "Are risks and dependencies explicit?",
      "Can the team use the checklist without more explanation?",
    ],
  },
  Operations: {
    role: "Operations workflow agent",
    output: "Process map, ownership checklist, handoff notes, and monitoring checks",
    steps: [
      "Identify the recurring workflow and success metric.",
      "List owners, inputs, blockers, and handoff points.",
      "Create a repeatable operating checklist.",
      "Add monitoring checks for quality and follow-up.",
    ],
    checks: [
      "Are owners and handoffs clear?",
      "Does the workflow reduce repeated manual decisions?",
      "Are monitoring checks tied to the success metric?",
    ],
  },
}

export function AgentWorkspace() {
  const [objective, setObjective] = useState(starterObjective)
  const [mode, setMode] = useState<AgentMode>("Research")
  const [brief, setBrief] = useState<AgentBrief | null>(null)

  const currentMode = modeConfig[mode]
  const wordCount = useMemo(() => objective.trim().split(/\s+/).filter(Boolean).length, [objective])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanObjective = objective.trim()
    if (!cleanObjective) {
      return
    }

    setBrief({
      role: currentMode.role,
      objective: cleanObjective,
      steps: currentMode.steps,
      checks: currentMode.checks,
      output: currentMode.output,
    })
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
                {(Object.keys(modeConfig) as AgentMode[]).map((value) => (
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
              <Button type="submit" size="lg" rounded="lg" className="w-full gap-2 sm:w-auto">
                <Wand2 className="h-4 w-4" />
                Build brief
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Agent output</p>
                <p className="text-lg font-semibold text-foreground">{brief?.role || currentMode.role}</p>
              </div>
              <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-sm text-primary">
                {mode}
              </span>
            </div>

            {brief ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-background/55 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Objective</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{brief.objective}</p>
                </div>

                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Workflow steps
                  </p>
                  <ol className="space-y-2">
                    {brief.steps.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-lg border border-border bg-background/55 p-3">
                  <p className="text-xs uppercase text-muted-foreground">Expected output</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{brief.output}</p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold text-foreground">Acceptance checks</p>
                  <ul className="space-y-2">
                    {brief.checks.map((check) => (
                      <li key={check} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-border bg-background/70 px-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Your Gemini Spark agent brief appears here after you describe the task.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
