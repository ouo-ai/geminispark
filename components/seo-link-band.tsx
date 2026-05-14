import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

import { getCoreSeoPages } from "@/lib/seo-pages"

export function SeoLinkBand() {
  const pages = getCoreSeoPages()

  return (
    <section className="relative border-t border-border py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            AI video guides
          </div>
          <h2 className="text-3xl font-bold tracking-display text-foreground sm:text-4xl">
            Learn the core <span className="text-gradient-spark">AI video workflows</span>
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Use these guides to plan text-to-video prompts, reference-image motion, and short-form AI video tasks.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pages.map((page) => (
            <Link
              key={page.slug}
              href={`/${page.slug}`}
              className="group rounded-xl border border-border bg-card/45 p-5 transition hover:border-primary/40 hover:bg-card/70"
            >
              <p className="mb-3 text-xs font-semibold uppercase text-primary">{page.primaryKeyword}</p>
              <h3 className="text-base font-semibold leading-snug text-foreground">{page.hero.headline}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{page.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                Read guide
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
