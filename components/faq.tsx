"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "What is Gemini Spark and how does it work?",
    answer:
      "Gemini Spark is an AI video generator that turns a text prompt, and optionally one public reference image URL, into a short video generation task. The page submits the task through a secure server route and checks status until the result is ready.",
  },
  {
    question: "What model name is shown in the product?",
    answer:
      "The product interface displays the model as Gemini Spark. Supplier routing and API credentials stay on the server and are not exposed in the browser.",
  },
  {
    question: "Is Gemini Spark affiliated with Google?",
    answer:
      "No. Gemini Spark is an independent product. It is not affiliated with Google or Google Gemini.",
  },
  {
    question: "Who is Gemini Spark built for?",
    answer:
      "Creators, marketers, founders, educators, consultants, and teams who need short AI videos for product launches, explainers, social ads, lessons, and concept previews.",
  },
  {
    question: "What can I create with Gemini Spark?",
    answer:
      "You can create text-to-video and image-to-video tasks for product reveals, campaign clips, social teasers, explainer scenes, and visual concept tests.",
  },
  {
    question: "Why do video links need to be saved?",
    answer:
      "Generated video links from the upstream task system may expire, so download or save any result you want to keep after the task completes.",
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
