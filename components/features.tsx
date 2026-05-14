"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Sparkles,
  Bot,
  Layers,
  Search,
  Wand2,
  ClipboardList,
  RefreshCw,
  Zap,
} from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "Agent brief builder",
    description: "Turn a rough objective into a structured role, workflow, output, and review checklist.",
  },
  {
    icon: ClipboardList,
    title: "Mode-based planning",
    description: "Choose research, marketing, product, or operations to shape the right working pattern.",
  },
  {
    icon: Bot,
    title: "Agent roles",
    description: "Define the perspective the task should use before it produces work.",
  },
  {
    icon: Search,
    title: "Acceptance checks",
    description: "Make quality criteria visible so agent output is easier to review.",
  },
  {
    icon: Wand2,
    title: "Prompt structure",
    description: "Capture goal, context, constraints, steps, output, and checks in one task brief.",
  },
  {
    icon: Layers,
    title: "Reusable starts",
    description: "Reuse stable brief patterns for recurring workflows and team handoffs.",
  },
  {
    icon: RefreshCw,
    title: "Workflow review",
    description: "Review the plan before using it in an agent runtime or AI tool.",
  },
  {
    icon: Zap,
    title: "Team workflows",
    description: "Support research, launch planning, product operations, and content planning from the same workspace.",
  },
]

export function Features() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="features" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4">
            Everything you need to <span className="text-gradient-spark">build agent workflows</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A practical AI agent workspace for creators, marketers, founders, and teams
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group relative p-5 sm:p-6 rounded-xl border border-border bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-all duration-300"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
