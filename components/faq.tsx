"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "What is Gemini Spark and how does it work?",
    answer:
      "Gemini Spark is an AI agent workspace that turns rough objectives into structured briefs with roles, workflow steps, constraints, expected outputs, and acceptance checks.",
  },
  {
    question: "What model name is shown in the product?",
    answer:
      "The product interface displays the model name as Gemini Spark.",
  },
  {
    question: "Is Gemini Spark affiliated with Google?",
    answer:
      "No. Gemini Spark is an independent product. It is not affiliated with Google or Google Gemini.",
  },
  {
    question: "Who is Gemini Spark built for?",
    answer:
      "Gemini Spark is built for creators, marketers, founders, educators, consultants, and teams that need clearer agent briefs for research, marketing, product, and operations work.",
  },
  {
    question: "What can I create with Gemini Spark?",
    answer:
      "You can create agent-ready task briefs, workflow outlines, acceptance checks, handoff notes, and prompt structures for repeatable work.",
  },
  {
    question: "Does Gemini Spark execute tasks automatically?",
    answer:
      "Gemini Spark focuses on planning and structuring the agent task. Execution depends on the AI tool, runtime, or team process you use after the brief is ready.",
  },
]

export function FAQ() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="faq" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4">
            Frequently asked <span className="text-gradient-spark">questions</span>
          </h2>
          <p className="text-muted-foreground">Everything you need to know about Gemini Spark</p>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border rounded-xl px-6 bg-card/30"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
