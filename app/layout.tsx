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
  title: "Gemini Spark - AI Agent Workspace",
  description:
    "Gemini Spark is an independent AI agent workspace for turning rough goals into structured agent briefs, workflows, and task plans.",
  keywords: [
    "Gemini Spark",
    "AI agent",
    "AI agent workspace",
    "AI agent builder",
    "AI agent workflow",
    "AI task agent",
    "agent prompt guide",
    "agent prompt examples",
    "workflow automation",
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
    title: "Gemini Spark - AI Agent Workspace",
    description:
      "Turn rough goals into structured AI agent briefs, workflows, and task plans with Gemini Spark.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Gemini Spark - AI Agent Workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gemini Spark - AI Agent Workspace",
    description:
      "Turn rough goals into structured AI agent briefs, workflows, and task plans with Gemini Spark.",
    images: [`${siteUrl}/opengraph-image`],
    creator: "@geminispark",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
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
          "Gemini Spark is an independent AI agent workspace. It is not affiliated with Google or Google Gemini.",
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
          "Gemini Spark is an independent AI agent workspace for turning goals into structured briefs, workflows, and task plans.",
        url: siteUrl,
        isAccessibleForFree: true,
        publisher: { "@id": `${siteUrl}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          description: "Agent brief planning is available through the Gemini Spark web interface.",
        },
        featureList: [
          "AI agent brief builder",
          "Agent workflow planning",
          "Role and acceptance-check generation",
          "Research, marketing, product, and operations modes",
          "Reusable task planning structure",
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
