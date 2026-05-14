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
  title: "Gemini Spark - AI Video Generator",
  description:
    "Gemini Spark is an independent AI video generator for turning prompts and public reference images into short cinematic videos.",
  keywords: [
    "Gemini Spark",
    "AI video generator",
    "Gemini Spark video",
    "text to video",
    "image to video",
    "AI video creation",
    "cinematic AI video",
    "video generation",
    "prompt to video",
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
    title: "Gemini Spark - AI Video Generator",
    description:
      "Generate short AI videos from prompts or public reference images with Gemini Spark.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Gemini Spark - AI Video Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gemini Spark - AI Video Generator",
    description:
      "Generate short AI videos from prompts or public reference images with Gemini Spark.",
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
          "Gemini Spark is an independent AI video generation brand. It is not affiliated with Google or Google Gemini.",
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
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        description:
          "Gemini Spark is an independent AI video generator for creating short videos from prompts and public reference images.",
        url: siteUrl,
        isAccessibleForFree: true,
        publisher: { "@id": `${siteUrl}/#organization` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          description: "Video generation is available through the Gemini Spark web interface.",
        },
        featureList: [
          "Text-to-video generation",
          "Image-to-video generation from public image URLs",
          "Generation task tracking",
          "Landscape and portrait output options",
          "Short-form cinematic video creation",
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
              text: "Gemini Spark is an independent AI video generator that submits prompt-based video tasks and tracks generation status until the video result is ready.",
            },
          },
          {
            "@type": "Question",
            name: "Can Gemini Spark generate video from an image?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Gemini Spark supports text-to-video by default and can use one public image URL as a reference for image-to-video generation.",
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
