import type { Metadata } from "next"

import { Footer } from "@/components/footer"
import { GeminiOmniStudio } from "@/components/gemini-omni-studio"
import { Navbar } from "@/components/navbar"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"

export const metadata: Metadata = {
  title: "Generation Studio | Gemini Spark",
  description:
    "Turn a single prompt or a few reference images into a 4K video or high-resolution image. Powered by Gemini Omni for video and Nano Banana for image generation.",
  keywords: [
    "Gemini Omni",
    "Nano Banana",
    "AI video generation",
    "AI image generation",
    "text to video",
    "text to image",
    "image to image",
    "generation studio",
  ],
  alternates: {
    canonical: `${siteUrl}/gemini-omni`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/gemini-omni`,
    siteName: "Gemini Spark",
    title: "Generation Studio | Gemini Spark",
    description:
      "Turn a prompt or reference images into a short video or polished image — Gemini Omni and Nano Banana under one roof.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Generation Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Generation Studio | Gemini Spark",
    description:
      "Generate AI video and images from a single prompt with Gemini Omni and Nano Banana.",
    images: [`${siteUrl}/opengraph-image`],
  },
}

export default function GeminiOmniPage() {
  const pageUrl = `${siteUrl}/gemini-omni`
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        name: "Generation Studio",
        url: pageUrl,
        description:
          "Use Generation Studio to produce short video clips and high-resolution images from text prompts or reference images.",
        isPartOf: { "@id": `${siteUrl}/#website` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${pageUrl}#software`,
        name: "Generation Studio",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        url: pageUrl,
        featureList: [
          "Text-to-video with Gemini Omni",
          "Text-to-image with Nano Banana",
          "Image-to-image editing with Nano Banana Edit",
          "Up to 4K video resolution",
          "Multiple aspect ratios",
          "Async task tracking with auto-refund on failure",
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
    <main className="relative min-h-dvh bg-background">
      <Navbar />
      <GeminiOmniStudio />
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}
