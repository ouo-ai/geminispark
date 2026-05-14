"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Film, Image, PlayCircle, Rocket } from "lucide-react"

const steps = [
  {
    icon: Film,
    title: "Describe the scene",
    description: "Write the subject, setting, motion, lighting, and camera feel you want Gemini Spark to generate.",
  },
  {
    icon: Image,
    title: "Add a reference",
    description: "Optionally paste a public image URL when you want the video to follow a visual direction.",
  },
  {
    icon: PlayCircle,
    title: "Submit the task",
    description: "Choose landscape or portrait, pick a duration, and start the generation securely from the server.",
  },
  {
    icon: Rocket,
    title: "Preview the result",
    description: "Track the task until it completes, then review the generated video directly on the page.",
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
            From raw prompt to generated video in four simple steps
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
