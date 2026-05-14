import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const _jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"

export const metadata: Metadata = {
  applicationName: "Gemini Spark",
  title: "Gemini Spark - Prompt Studio for Better AI Briefs",
  description:
    "Gemini Spark is an independent prompt studio for turning rough ideas into Gemini-ready prompts, content briefs, research plans, and launch copy.",
  keywords: [
    "Gemini Spark",
    "AI prompt studio",
    "prompt engineering",
    "workflow builder",
    "content briefs",
    "research plans",
    "AI prompts",
    "prompt templates",
  ],
  authors: [{ name: "Gemini Spark" }],
  creator: "Gemini Spark",
  publisher: "Gemini Spark",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Gemini Spark",
    title: "Gemini Spark - Prompt Studio for Better AI Briefs",
    description:
      "Turn rough ideas into Gemini-ready prompts, content briefs, research plans, and launch copy with the independent Gemini Spark prompt studio.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Gemini Spark - AI Prompt Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gemini Spark - Prompt Studio for Better AI Briefs",
    description:
      "Turn rough ideas into Gemini-ready prompts, content briefs, research plans, and launch copy.",
    images: [`${siteUrl}/opengraph-image`],
    creator: "@geminispark",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Gemini Spark",
        url: siteUrl,
        description:
          "Gemini Spark is an independent prompt studio brand. It is not affiliated with Google or Google Gemini.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Gemini Spark",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "Gemini Spark",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        description:
          "Gemini Spark is an independent AI prompt studio and workflow builder for creating Gemini-ready prompts, content briefs, research plans, and launch copy.",
        url: siteUrl,
        isAccessibleForFree: true,
        publisher: { "@id": `${siteUrl}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/PreOrder",
          description: "Planned free access at launch; no live paid checkout is available on this page.",
        },
        featureList: [
          "Prompt studio",
          "Workflow builder",
          "Content brief templates",
          "Research plan templates",
          "Reusable prompt systems",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Gemini Spark and how does it work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Gemini Spark is an independent prompt studio and workflow builder that helps users turn rough ideas into structured prompts, briefs, and research plans for use with AI tools.",
            },
          },
          {
            "@type": "Question",
            name: "Does Gemini Spark connect to the Gemini API?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Not currently. Gemini Spark focuses on prompt preparation and reusable workflows before users bring the finished prompt into Gemini or another AI tool.",
            },
          },
          {
            "@type": "Question",
            name: "Is Gemini Spark affiliated with Google?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Gemini Spark is an independent product and is not affiliated with Google or Google Gemini.",
            },
          },
        ],
      },
    ],
  }

  return (
    <html lang="en" className={`dark bg-background ${inter.variable} ${_jetbrainsMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
