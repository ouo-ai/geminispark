import type { Metadata } from "next"

import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { PricingPage } from "@/components/pricing-page"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"

export const metadata: Metadata = {
  title: "Pricing | Gemini Spark",
  description:
    "View Gemini Spark paid plans, annual pricing, monthly credits, and one-time credit packs for chat, image, and video agent work.",
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/pricing`,
    siteName: "Gemini Spark",
    title: "Pricing | Gemini Spark",
    description:
      "Compare Gemini Spark annual and monthly paid plans, then add one-time credit packs when a project needs extra capacity.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Gemini Spark pricing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Gemini Spark",
    description: "Gemini Spark paid plans and credit packs for chat, image, and video agent work.",
    images: [`${siteUrl}/opengraph-image`],
  },
}

export default function Page() {
  return (
    <main className="relative z-0 min-h-screen overflow-x-hidden bg-background">
      <Navbar />
      <PricingPage />
      <Footer />
    </main>
  )
}
