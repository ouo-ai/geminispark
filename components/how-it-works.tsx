"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Bot, ClipboardList, ListChecks, Rocket } from "lucide-react"

const steps = [
  {
    icon: Bot,
    title: "Describe the goal",
    description: "Write the objective, audience, context, and result you want the AI agent task to produce.",
  },
  {
    icon: ClipboardList,
    title: "Choose the mode",
    description: "Pick research, marketing, product, or operations so Gemini Spark can shape the right agent role.",
  },
  {
    icon: ListChecks,
    title: "Build the brief",
    description: "Generate workflow steps, expected output, and acceptance checks before execution starts.",
  },
  {
    icon: Rocket,
    title: "Run with clarity",
    description: "Use the structured brief in your AI tool, review the checks, and hand off the result cleanly.",
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4">
            How <span className="text-gradient-spark">Gemini Spark</span> works
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From raw goal to agent-ready workflow in four simple steps
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connection line for desktop */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="relative text-center"
            >
              <div className="relative inline-block mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
