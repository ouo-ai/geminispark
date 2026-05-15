import type { Metadata } from "next"

import { GeminiSparkChat } from "@/components/gemini-spark-chat"
import { Navbar } from "@/components/navbar"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"

export const metadata: Metadata = {
  title: "Gemini Spark Chat | Text, Image, and Video Agent",
  description:
    "Use Gemini Spark Chat as a fused AI agent for text, image, and video requests in one full-screen workspace.",
  keywords: [
    "Gemini Spark chat",
    "multimodal AI agent",
    "AI chat workspace",
    "AI agent conversation",
    "text image video agent",
    "agent workflow chat",
    "AI agent brief",
  ],
  alternates: {
    canonical: `${siteUrl}/gemini-spark`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/gemini-spark`,
    siteName: "Gemini Spark",
    title: "Gemini Spark Chat | Text, Image, and Video Agent",
    description:
      "A fused Gemini Spark agent for text, image, and video requests in one full-screen workspace.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Gemini Spark Chat workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gemini Spark Chat | Text, Image, and Video Agent",
    description:
      "Route text, image, and video requests from one fused Gemini Spark chat workspace.",
    images: [`${siteUrl}/opengraph-image`],
  },
}

export default function GeminiSparkPage() {
  const pageUrl = `${siteUrl}/gemini-spark`
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "Gemini Spark Chat",
        url: pageUrl,
        description:
          "A fused Gemini Spark agent for text, image, and video requests in one full-screen workspace.",
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${pageUrl}#software`,
        name: "Gemini Spark Chat",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        url: pageUrl,
        isAccessibleForFree: true,
        featureList: [
          "AI chat sessions",
          "Automatic request routing",
          "Gemini Spark text responses",
          "Gemini Spark image generation",
          "Gemini Spark video generation",
          "Conversation context tracking",
        ],
        publisher: {
          "@type": "Organization",
          name: "Gemini Spark",
          url: siteUrl,
        },
      },
    ],
  }

  return (
    <main className="relative z-0 min-h-dvh overflow-x-hidden bg-background lg:h-dvh lg:overflow-hidden">
      <Navbar />
      <GeminiSparkChat />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}
