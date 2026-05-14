"use client"

import { motion, useReducedMotion } from "framer-motion"
import { X, Check, ArrowRight } from "lucide-react"

const problems = [
  "Agent ideas stuck as loose notes instead of executable briefs",
  "Unclear roles, constraints, and expected outputs",
  "Multi-step work that starts without review checks",
  "Repeated tasks that never become reusable workflows",
]

const benefits = [
  "A focused workspace for AI agent task briefs",
  "Research, marketing, product, and operations modes",
  "Structured steps, outputs, and acceptance checks",
  "Reusable planning patterns for recurring work",
]

export function ProblemBenefit() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative py-20 lg:py-28 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4">
            Stop guessing. <span className="text-gradient-spark">Start building.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Gemini Spark gives teams one place to turn rough goals into structured AI agent workflows.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Problems Column */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-6 sm:p-8 rounded-2xl border border-border bg-card/30"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">The old way is slow</h3>
            </div>
            <ul className="space-y-4">
              {problems.map((problem, index) => (
                <motion.li
                  key={index}
                  initial={shouldReduceMotion ? {} : { opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-2 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{problem}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Benefits Column */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 sm:p-8 rounded-2xl border border-primary/30 bg-primary/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">With Gemini Spark</h3>
            </div>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.li
                  key={index}
                  initial={shouldReduceMotion ? {} : { opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground leading-relaxed">{benefit}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            See how it works
            <ArrowRight className="w-4 h-4" />
          </p>
        </motion.div>
      </div>
    </section>
  )
}
