"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FinalCTA() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="create" className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div
        className="relative max-w-5xl mx-auto bg-background rounded-3xl overflow-hidden py-16 lg:py-24 px-6 sm:px-12"
        style={{
          border: "1px dashed",
          borderColor: "oklch(0.85 0.16 75 / 0.4)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-display mb-6 text-foreground">
              Ready to structure your next agent task?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Open Gemini Spark, describe the objective, and build an agent-ready brief.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" rounded="full" className="gap-2 min-w-[200px]" asChild>
                <a href="#agent-workspace">
                  Build Agent Brief
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" size="xl" rounded="full" className="gap-2 min-w-[200px] bg-transparent" asChild>
                <a href="#how-it-works">
                  How it Works
                </a>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              The workspace helps you plan roles, workflows, and acceptance checks before execution.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
