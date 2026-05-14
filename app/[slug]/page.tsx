import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react"

import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { getRelatedSeoPages, getSeoPage, seoPages } from "@/lib/seo-pages"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return seoPages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = getSeoPage(slug)

  if (!page) {
    return {}
  }

  const url = `${siteUrl}/${page.slug}`

  return {
    title: page.title,
    description: page.description,
    keywords: [page.primaryKeyword, ...page.secondaryKeywords, "Gemini Spark"],
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      siteName: "Gemini Spark",
      title: page.title,
      description: page.description,
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: page.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [`${siteUrl}/opengraph-image`],
    },
  }
}

export default async function SeoPageRoute({ params }: PageProps) {
  const { slug } = await params
  const page = getSeoPage(slug)

  if (!page) {
    notFound()
  }

  const relatedPages = getRelatedSeoPages(page)
  const pageUrl = `${siteUrl}/${page.slug}`
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.primaryKeyword,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: page.hero.headline,
        description: page.description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        author: {
          "@type": "Organization",
          name: "Gemini Spark",
          url: siteUrl,
        },
        publisher: {
          "@type": "Organization",
          name: "Gemini Spark",
          url: siteUrl,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/icon-512.png`,
          },
        },
        inLanguage: "en-US",
        datePublished: "2026-05-14",
        dateModified: "2026-05-14",
        keywords: [page.primaryKeyword, ...page.secondaryKeywords].join(", "),
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  }

  return (
    <main className="relative z-0 min-h-screen overflow-x-hidden bg-background">
      <Navbar />

      <section className="relative border-b border-border pt-28 sm:pt-32">
        <div
          className="pointer-events-none absolute right-0 top-0 -z-10 h-[760px] w-[760px] bg-primary/20"
          style={{
            maskImage: "radial-gradient(ellipse 55% 45% at 70% 10%, rgb(0 0 0 / 0.65), transparent)",
          }}
        >
          <div className="absolute inset-0 bg-cover bg-right-top" style={{ backgroundImage: "url('/grade.png')" }} />
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {page.hero.eyebrow}
          </div>
          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-display text-foreground sm:text-5xl lg:text-6xl">
            {page.hero.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{page.hero.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={page.cta.href}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85"
            >
              {page.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#faq"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-transparent px-6 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-foreground/10"
            >
              Read FAQ
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-18">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
          <article className="space-y-6">
            {page.sections.map((section) => (
              <section key={section.heading} className="rounded-xl border border-border bg-card/40 p-5 sm:p-6">
                <h2 className="text-2xl font-semibold tracking-display text-foreground">{section.heading}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{section.body}</p>
                <ul className="mt-5 space-y-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3 text-sm leading-6 text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section id="faq" className="rounded-xl border border-border bg-card/40 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold tracking-display text-foreground">
                {page.primaryKeyword} FAQ
              </h2>
              <div className="mt-5 divide-y divide-border">
                {page.faqs.map((faq) => (
                  <div key={faq.question} className="py-5 first:pt-0 last:pb-0">
                    <h3 className="text-base font-semibold text-foreground">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-5">
              <p className="text-xs font-semibold uppercase text-primary">Create with Gemini Spark</p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Open the generator, write a prompt, choose a format, and track the video task from the homepage.
              </p>
              <Link
                href="/#generator"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85"
              >
                Go to generator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-xl border border-border bg-card/40 p-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Related guides</p>
              <div className="mt-4 space-y-3">
                {relatedPages.map((relatedPage) => (
                  <Link
                    key={relatedPage.slug}
                    href={`/${relatedPage.slug}`}
                    className="block rounded-lg border border-border bg-background/45 p-3 transition hover:border-primary/35 hover:bg-background/75"
                  >
                    <span className="text-sm font-medium text-foreground">{relatedPage.primaryKeyword}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{relatedPage.description}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Footer />
    </main>
  )
}
