"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CheckCircle2 } from "lucide-react"

const examples = [
  {
    title: "Campaign brief",
    input: "Launch a new AI note-taking feature for remote product teams.",
    output: "Positioning, audience, objections, channel angles, and a Gemini-ready prompt.",
  },
  {
    title: "Research plan",
    input: "Compare customer onboarding patterns across three SaaS competitors.",
    output: "Question map, evidence table, synthesis prompts, and final report structure.",
  },
  {
    title: "Reusable prompt system",
    input: "Turn messy product ideas into landing page copy every week.",
    output: "A repeatable prompt chain for value props, sections, FAQ, and CTA variants.",
  },
]

export function Testimonials() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative py-16 sm:py-24 lg:py-32 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-display mb-4">
            Example <span className="text-gradient-spark">workflow outputs</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Concrete ways Gemini Spark turns a rough input into useful prompt-ready structure
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {examples.map((example, index) => (
            <motion.div
              key={example.title}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-4 sm:p-6 rounded-lg border border-border bg-card/50"
            >
              <div className="flex items-center gap-2 mb-4 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-foreground">{example.title}</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Input</p>
                  <p className="text-sm text-foreground leading-relaxed">{example.input}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Output</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{example.output}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
