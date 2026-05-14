import Link from "next/link"
import Image from "next/image"

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Use Cases", href: "#use-cases" },
    { label: "FAQ", href: "#faq" },
  ],
  Resources: [
    { label: "How it Works", href: "#how-it-works" },
    { label: "Request Access", href: "mailto:hello@geminispark.ai?subject=Gemini%20Spark%20early%20access" },
    { label: "Independence Note", href: "#faq" },
  ],
}

export function Footer() {
  return (
    <footer className="relative border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <span className="relative inline-block h-5 w-5 overflow-hidden rounded border border-primary/25">
                <Image src="/icon-192.png" alt="" fill sizes="20px" className="object-cover" />
              </span>
              <span className="font-bold text-foreground" style={{ letterSpacing: 0 }}>
                Gemini Spark
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">
              Turn prompts into short AI videos.
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Not affiliated with Google or Google Gemini.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-medium tracking-wider uppercase text-muted-foreground mb-3 sm:mb-4">
                {category}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Gemini Spark. All rights reserved.
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground/70">
            Independent AI video generation site for geminispark.ai.
          </p>
        </div>
      </div>
    </footer>
  )
}
