"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "What is Gemini Spark and how does it work?",
    answer:
      "Gemini Spark is an AI prompt studio and workflow builder that helps you turn rough ideas into polished, Gemini-ready prompts. You start with a concept, use our guided templates to add structure, and get a refined prompt, brief, or research plan ready to use with any AI tool. It's about building reusable systems, not just one-off prompts.",
  },
  {
    question: "Does Gemini Spark connect to the Gemini API?",
    answer:
      "Not currently. Gemini Spark focuses on prompt crafting and workflow building—the preparation that happens before you talk to any AI. You take your refined prompts and use them with Gemini, ChatGPT, Claude, or any other AI tool. API integration is on our roadmap for future releases.",
  },
  {
    question: "Is Gemini Spark affiliated with Google?",
    answer:
      "No. Gemini Spark is an independent product. We're not affiliated with Google or the Gemini AI model. We're a prompt studio that helps you create better inputs for any AI system, including Google's Gemini.",
  },
  {
    question: "Who is Gemini Spark built for?",
    answer:
      "Creators, marketers, students, educators, consultants, and teams who regularly work with AI tools. If you find yourself writing the same kinds of prompts over and over, or struggling to get consistent quality from AI outputs, Gemini Spark gives you structure and reusability.",
  },
  {
    question: "What can I create with Gemini Spark?",
    answer:
      "Refined prompts for any AI tool, content briefs for blog posts and landing pages, research plans with organized sections and synthesis prompts, campaign messaging hierarchies, launch copy drafts, and reusable workflow templates. The focus is on preparation and structure, not generation.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. The prompt studio, basic templates, and research outlines are free to use. Pro features like workflow builder, prompt chains, version history, and team collaboration are coming soon as a paid tier. Join the waitlist to be first to know.",
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
