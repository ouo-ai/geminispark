"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Sparkles,
  Film,
  Layers,
  Search,
  Wand2,
  Image,
  RefreshCw,
  Zap,
} from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "Text-to-video",
    description: "Turn a compact scene description into a generated short video with one focused form.",
  },
  {
    icon: Image,
    title: "Image-to-video",
    description: "Use one public reference image URL to guide subject, framing, and visual direction.",
  },
  {
    icon: Film,
    title: "Format controls",
    description: "Choose landscape or portrait output and select short-form durations from the UI.",
  },
  {
    icon: Search,
    title: "Task tracking",
    description: "Keep the task ID, status, progress, and result preview visible after submission.",
  },
  {
    icon: Wand2,
    title: "Server-side API",
    description: "The generation key stays on the server while the browser talks only to Gemini Spark routes.",
  },
  {
    icon: Layers,
    title: "Reusable starts",
    description: "A starter prompt and stable controls make repeat generation tests faster.",
  },
  {
    icon: RefreshCw,
    title: "Auto polling",
    description: "The page checks the task status every few seconds until the result is ready.",
  },
  {
    icon: Zap,
    title: "Launch assets",
    description: "Create product reveals, ad concepts, explainers, and social teasers from the same workflow.",
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
            Everything you need to <span className="text-gradient-spark">generate video</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A practical AI video workspace for creators, marketers, founders, and teams
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
