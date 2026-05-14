"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  Sparkles,
  FileText,
  Lightbulb,
  Layers,
  Wand2,
  PenTool,
  Search,
  Rocket,
  BookOpen,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#use-cases", label: "Use Cases" },
  { href: "/#faq", label: "FAQ" },
]

const workflowItems = [
  { href: "/#generator", label: "Video Generator", icon: Sparkles },
  { href: "/text-to-video-ai", label: "Text to Video", icon: FileText },
  { href: "/image-to-video-ai", label: "Image to Video", icon: Search },
  { href: "/ai-product-video-generator", label: "Launch Videos", icon: Rocket },
]

const toolsMenu = {
  video: [
    {
      category: "Ideation",
      items: [
        { href: "/ai-video-generator", label: "Video Generator", icon: Lightbulb },
        { href: "/text-to-video-ai", label: "Prompt to Video", icon: FileText },
      ],
    },
    {
      category: "Controls",
      items: [
        { href: "/image-to-video-ai", label: "Reference Image", icon: Search },
        { href: "/ai-video-prompt-guide", label: "Prompt Guide", icon: BookOpen },
      ],
    },
  ],
  production: [
    {
      category: "Pro Studio",
      items: [
        { href: "/ai-video-prompt-examples", label: "Prompt Examples", icon: Layers },
        { href: "/ai-video-generator-for-social-media", label: "Social Clips", icon: Wand2 },
      ],
    },
    {
      category: "Production",
      items: [
        { href: "/ai-product-video-generator", label: "Product Videos", icon: PenTool },
        { href: "/ai-video-generator-for-marketing", label: "Campaign Clips", icon: Rocket },
      ],
    },
  ],
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="mx-auto max-w-6xl px-2 sm:px-4 lg:px-8 py-4" aria-label="Main navigation">
        <div className="flex h-14 items-center justify-between bg-background/60 backdrop-blur-xl border border-border/50 rounded-full px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Gemini Spark home">
            <div className="relative h-6 w-6 overflow-hidden rounded-md border border-primary/25 shadow-[0_0_18px_rgba(245,180,50,0.2)]">
              <Image src="/icon-192.png" alt="" fill sizes="24px" className="object-cover" priority />
            </div>
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-base sm:text-lg text-foreground"
              style={{ letterSpacing: 0 }}
            >
              Gemini Spark
            </span>
          </Link>

          {/* Desktop Navigation - hidden below lg */}
          <div className="hidden lg:flex items-center gap-8">
            {/* Tools Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
                Tools
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[480px] max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-xl border-border p-4"
              >
                <div className="grid grid-cols-2 gap-6">
                  {/* Video tools column */}
                  <div>
                    <DropdownMenuLabel className="flex items-center gap-2 text-primary font-semibold mb-2">
                      Video Tools
                    </DropdownMenuLabel>
                    {toolsMenu.video.map((cat) => (
                      <div key={cat.category} className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 px-2">
                          {cat.category}
                        </div>
                        {cat.items.map((item) => (
                          <DropdownMenuItem key={item.href} asChild className="group">
                            <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                              <item.icon
                                className="w-4 h-4 text-primary group-data-[highlighted]:text-primary-foreground transition-colors"
                                aria-hidden="true"
                              />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Production guides column */}
                  <div>
                    <DropdownMenuLabel className="flex items-center gap-2 text-primary font-semibold mb-2">
                      Production Guides
                    </DropdownMenuLabel>
                    {toolsMenu.production.map((cat) => (
                      <div key={cat.category} className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 px-2">
                          {cat.category}
                        </div>
                        {cat.items.map((item) => (
                          <DropdownMenuItem key={item.href} asChild className="group">
                            <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                              <item.icon
                                className="w-4 h-4 text-primary group-data-[highlighted]:text-primary-foreground transition-colors"
                                aria-hidden="true"
                              />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Workflows Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
                Workflows
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-card/95 backdrop-blur-xl border-border">
                {workflowItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild className="group">
                    <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                      <item.icon
                        className="w-4 h-4 text-primary group-data-[highlighted]:text-primary-foreground transition-colors"
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Nav Links */}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Buttons - hidden below lg */}
          <div className="hidden lg:flex items-center gap-3">
            <Button variant="ghost" size="sm" rounded="full" asChild>
              <Link href="/#how-it-works">How it works</Link>
            </Button>
            <Button size="sm" rounded="full" className="gap-1.5" asChild>
              <Link href="/#generator">
                Generate Now
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button - visible below lg */}
          <button
            type="button"
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Menu - visible below lg */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 top-0 left-0 w-dvw h-dvh bg-background z-40 flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-background border-b border-border/50">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <span className="relative inline-block h-6 w-6 overflow-hidden rounded-md border border-primary/25">
                    <Image src="/icon-192.png" alt="" fill sizes="24px" className="object-cover" />
                  </span>
                  <span
                    className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-base text-foreground"
                    style={{ letterSpacing: 0 }}
                  >
                    Gemini Spark
                  </span>
                </Link>
                <button
                  type="button"
                  className="p-2 text-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
                {/* Tools Section */}
                <div className="px-4 py-2 text-xs font-medium text-primary uppercase tracking-wider">Video Tools</div>
                {toolsMenu.video.map((cat) => (
                  <div key={cat.category}>
                    <div className="px-4 py-1 text-xs text-muted-foreground">{cat.category}</div>
                    {cat.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-2 px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <item.icon
                          className="w-5 h-5 text-primary group-hover:text-primary transition-colors"
                          aria-hidden="true"
                        />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <div className="px-4 py-2 text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
                  Production Guides
                </div>
                {toolsMenu.production.map((cat) => (
                  <div key={cat.category}>
                    <div className="px-4 py-1 text-xs text-muted-foreground">{cat.category}</div>
                    {cat.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-2 px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <item.icon
                          className="w-5 h-5 text-primary group-hover:text-primary transition-colors"
                          aria-hidden="true"
                        />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <div className="border-t border-border/50 my-3" />
                {/* Workflows Section */}
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Workflows
                </div>
                {workflowItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-2 px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon
                      className="w-5 h-5 text-primary group-hover:text-primary transition-colors"
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                ))}
                <div className="border-t border-border/50 my-3" />
                {/* Nav Links Section */}
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-border/50 bg-background flex flex-col gap-3">
                <Button variant="ghost" rounded="lg" className="justify-center text-base py-6 w-full" asChild>
                  <Link href="/#how-it-works" onClick={() => setMobileMenuOpen(false)}>
                    How it works
                  </Link>
                </Button>
                <Button rounded="full" className="py-6 text-base w-full" asChild>
                  <Link href="/#generator" onClick={() => setMobileMenuOpen(false)}>
                    Generate Now
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}
