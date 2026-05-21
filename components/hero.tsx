"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Video } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useState, useEffect, useRef } from "react"
import { GEMINI_SPARK_PENDING_PROMPT_KEY } from "@/lib/gemini-spark-prompt-transfer"
import { captureEvent } from "@/lib/posthog-client"

const examplePrompts = [
  "Plan a research agent for...",
  "Build a launch workflow for...",
  "Turn customer notes into...",
  "Create an agent brief for...",
  "Draft a product ops checklist...",
]

const trustedBy = [
  { name: "Creators", text: "Creators" },
  { name: "Marketers", text: "Marketers" },
  { name: "Educators", text: "Educators" },
  { name: "Students", text: "Students" },
  { name: "Teams", text: "Teams" },
]

const planningModes = ["Research", "Marketing", "Product", "Ops"]

export function Hero() {
  const shouldReduceMotion = useReducedMotion()
  const [prompt, setPrompt] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const hasTrackedPromptFocus = useRef(false)
  const hasTrackedPromptStart = useRef(false)

  const [displayText, setDisplayText] = useState("")
  const [promptIndex, setPromptIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(true)
  const cleanPrompt = prompt.trim()

  useEffect(() => {
    if (prompt || isFocused || shouldReduceMotion) {
      setDisplayText("")
      return
    }

    const currentPrompt = examplePrompts[promptIndex]
    let charIndex = 0
    let timeout: NodeJS.Timeout

    if (isTyping) {
      timeout = setInterval(() => {
        if (charIndex <= currentPrompt.length) {
          setDisplayText(currentPrompt.slice(0, charIndex))
          charIndex++
        } else {
          clearInterval(timeout)
          setTimeout(() => setIsTyping(false), 2000)
        }
      }, 50)
    } else {
      charIndex = currentPrompt.length
      timeout = setInterval(() => {
        if (charIndex >= 0) {
          setDisplayText(currentPrompt.slice(0, charIndex))
          charIndex--
        } else {
          clearInterval(timeout)
          setPromptIndex((prev) => (prev + 1) % examplePrompts.length)
          setIsTyping(true)
        }
      }, 30)
    }

    return () => clearInterval(timeout)
  }, [promptIndex, isTyping, prompt, isFocused, shouldReduceMotion])

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  }

  function persistPromptForChat() {
    if (!cleanPrompt) {
      return
    }

    try {
      window.sessionStorage.setItem(GEMINI_SPARK_PENDING_PROMPT_KEY, cleanPrompt)
    } catch {
      // The chat still opens when session storage is unavailable.
    }
  }

  function trackPromptFocus() {
    setIsFocused(true)

    if (hasTrackedPromptFocus.current) {
      return
    }

    hasTrackedPromptFocus.current = true
    captureEvent("landing_prompt_focused", {
      location: "hero",
    })
  }

  function updatePrompt(value: string) {
    setPrompt(value)

    const nextPrompt = value.trim()
    if (!nextPrompt || hasTrackedPromptStart.current) {
      return
    }

    hasTrackedPromptStart.current = true
    captureEvent("landing_prompt_started", {
      location: "hero",
      prompt_length: nextPrompt.length,
    })
  }

  function trackHeroAction(action: "chat_inline" | "chat_primary" | "generation_studio" | "how_it_works") {
    if (action !== "how_it_works") {
      persistPromptForChat()
    }

    captureEvent("cta_clicked", {
      location: "hero",
      action,
      destination: action === "how_it_works" ? "#how-it-works" : "/gemini-spark",
      has_prompt: Boolean(cleanPrompt),
      prompt_length: cleanPrompt.length,
    })
  }

  return (
    <>
    <section className="relative flex flex-col overflow-hidden">
      <div className="hero-glow absolute inset-0 pointer-events-none" />
      
      <div className="flex items-center justify-center pt-28 lg:pt-32 pb-12 sm:pb-14">
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/5 text-sm text-primary"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Agent Workspace</span>
          </motion.div>

          <motion.h1
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-display text-balance mb-6 leading-[1.1]"
          >
            <span className="text-gradient-spark">Gemini Spark</span>
            <br />
            <span className="text-foreground">turns goals into AI agent briefs</span>
          </motion.h1>

          <motion.p
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty leading-relaxed px-2"
          >
            Gemini Spark helps you shape rough objectives into agent-ready workflows.
            Define the role, steps, constraints, output, and acceptance checks from one focused workspace.
          </motion.p>

          <motion.div
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-2xl mx-auto mb-6"
          >
            <div className="relative bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_40px_rgba(66,133,244,0.16),0_0_80px_rgba(124,77,255,0.08)]">
              <div className="relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => updatePrompt(e.target.value)}
                  onFocus={trackPromptFocus}
                  onBlur={() => setIsFocused(false)}
                  placeholder=""
                  className="w-full bg-transparent px-4 sm:px-5 py-3 sm:py-4 pr-20 sm:pr-32 text-foreground focus:outline-none text-sm sm:text-base"
                  aria-label="Try a prompt idea"
                />
                {!prompt && !isFocused && (
                  <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none text-sm sm:text-base text-muted-foreground truncate max-w-[60%] sm:max-w-none">
                    {displayText}
                    <span className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 animate-pulse align-middle" />
                  </div>
                )}
                {!prompt && isFocused && (
                  <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none text-sm sm:text-base text-muted-foreground/50">
                    Describe your agent task...
                  </div>
                )}
              </div>
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button size="sm" rounded="lg" asChild>
                  <Link href="/gemini-spark" onClick={() => trackHeroAction("chat_inline")}>
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Chat
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mx-auto mt-7 w-full max-w-4xl rounded-2xl border border-white/10 bg-card/55 p-5 text-left backdrop-blur-xl sm:p-6"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Agent planning is live
                </div>
                <p className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                  Research, marketing, product, and ops workflows.
                </p>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Agent planning modes">
                  {planningModes.map((mode) => (
                    <span
                      key={mode}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                <Button rounded="full" className="px-4" asChild>
                  <Link href="/gemini-spark" onClick={() => trackHeroAction("chat_primary")}>
                    Open Chat
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="secondary" rounded="full" className="px-3.5" asChild>
                  <Link href="/gemini-omni" onClick={() => trackHeroAction("generation_studio")}>
                    <Video className="w-4 h-4" />
                    Gemini Omni
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

    </section>

      <motion.section
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="relative py-6 sm:py-7 border-t border-border/30 bg-background/80 backdrop-blur-sm"
        aria-label="Audience"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs sm:text-sm text-muted-foreground/60 mb-4 sm:mb-6 text-center">
            Built for
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-12 gap-y-3 sm:gap-y-4">
            {trustedBy.map((item) => (
              <span
                key={item.name}
                className="text-base sm:text-lg md:text-xl font-semibold text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
              >
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </motion.section>
    </>
  )
}
