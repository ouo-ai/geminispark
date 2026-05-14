"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Sparkles,
  FileText,
  Layers,
  Search,
  Wand2,
  FolderOpen,
  RefreshCw,
  Zap,
} from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "Prompt Studio",
    description: "Craft and refine prompts with guided templates. Turn vague ideas into clear, effective instructions.",
  },
  {
    icon: Layers,
    title: "Workflow Builder",
    description: "Chain prompts together into reusable workflows. Build systems that handle complex multi-step processes.",
    badge: "Coming Soon",
  },
  {
    icon: FileText,
    title: "Content Briefs",
    description: "Generate structured briefs for blog posts, landing pages, email campaigns, and social content.",
  },
  {
    icon: Search,
    title: "Research Plans",
    description: "Create comprehensive research outlines with organized sections, key questions, and synthesis prompts.",
  },
  {
    icon: Wand2,
    title: "Prompt Refinement",
    description: "Iterate on your prompts with smart suggestions. See what works and why your outputs improve.",
  },
  {
    icon: FolderOpen,
    title: "Prompt Library",
    description: "Save your best prompts and workflows. Build a personal knowledge base of proven templates.",
  },
  {
    icon: RefreshCw,
    title: "Version History",
    description: "Track changes to your prompts over time. Roll back when needed and learn from what worked.",
    badge: "Coming Soon",
  },
  {
    icon: Zap,
    title: "Quick Actions",
    description: "Jump-start common tasks with one-click templates for social posts, emails, headlines, and more.",
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
            Everything you need to <span className="text-gradient-spark">spark ideas</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A complete prompt studio for creators, marketers, researchers, and teams
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
              {feature.badge && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
                  {feature.badge}
                </span>
              )}
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
