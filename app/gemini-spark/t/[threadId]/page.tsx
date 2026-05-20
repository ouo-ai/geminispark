import type { Metadata } from "next"

import { GeminiSparkChat } from "@/components/gemini-spark-chat"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"

export const metadata: Metadata = {
  title: "Gemini Spark Chat | Text, Image, and Video Agent",
  description:
    "Use Gemini Spark Chat as a fused AI agent for text, image, and video requests in one full-screen workspace.",
  alternates: {
    canonical: `${siteUrl}/gemini-spark`,
  },
}

type PageProps = {
  params: Promise<{
    threadId: string
  }>
}

export default async function GeminiSparkThreadPage({ params }: PageProps) {
  const { threadId } = await params

  return (
    <main className="relative z-0 h-dvh min-h-dvh overflow-hidden bg-background">
      <GeminiSparkChat initialThreadId={threadId} />
    </main>
  )
}
