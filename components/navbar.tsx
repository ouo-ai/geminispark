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
  Bot,
  ClipboardList,
  Video,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { captureEvent } from "@/lib/posthog-client"

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#use-cases", label: "Use Cases" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
]

const workflowItems = [
  { href: "/gemini-spark", label: "Gemini Spark Chat", icon: Sparkles },
  { href: "/gemini-omni", label: "Generation Studio", icon: Video },
  { href: "/ai-agent-builder", label: "Agent Builder", icon: Bot },
  { href: "/ai-agent-workflow", label: "Agent Workflow", icon: ClipboardList },
  { href: "/ai-agent-for-product-teams", label: "Product Agents", icon: Rocket },
]

const toolsMenu = {
  agent: [
    {
      category: "Ideation",
      items: [
        { href: "/ai-agent", label: "AI Agent", icon: Lightbulb },
        { href: "/ai-agent-builder", label: "Agent Builder", icon: FileText },
        { href: "/gemini-omni", label: "Generation Studio", icon: Video },
      ],
    },
    {
      category: "Controls",
      items: [
        { href: "/ai-agent-workflow", label: "Workflow Planner", icon: Search },
        { href: "/ai-agent-prompt-guide", label: "Prompt Guide", icon: BookOpen },
      ],
    },
  ],
  teams: [
    {
      category: "Guides",
      items: [
        { href: "/ai-agent-prompt-examples", label: "Prompt Examples", icon: Layers },
        { href: "/ai-agent-for-research", label: "Research Agents", icon: Wand2 },
      ],
    },
    {
      category: "Teams",
      items: [
        { href: "/ai-agent-for-product-teams", label: "Product Agents", icon: PenTool },
        { href: "/ai-agent-for-marketing", label: "Marketing Agents", icon: Rocket },
      ],
    },
  ],
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function trackNavClick(label: string, href: string, location: string) {
    captureEvent("nav_link_clicked", {
      label,
      href,
      location,
    })
  }

  function closeMobileMenuAfterClick(label: string, href: string, location: string) {
    trackNavClick(label, href, location)
    setMobileMenuOpen(false)
  }

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
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="Gemini Spark home"
            onClick={() => trackNavClick("Gemini Spark", "/", "desktop_brand")}
          >
            <div className="relative h-6 w-6 overflow-hidden rounded-md border border-primary/25 shadow-[0_0_18px_rgba(66,133,244,0.24)]">
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
                  <div>
                    <DropdownMenuLabel className="flex items-center gap-2 text-primary font-semibold mb-2">
                      Agent Tools
                    </DropdownMenuLabel>
                    {toolsMenu.agent.map((cat) => (
                      <div key={cat.category} className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 px-2">
                          {cat.category}
                        </div>
                        {cat.items.map((item) => (
                          <DropdownMenuItem key={item.href} asChild className="group">
                            <Link
                              href={item.href}
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => trackNavClick(item.label, item.href, "desktop_tools_menu")}
                            >
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
                  <div>
                    <DropdownMenuLabel className="flex items-center gap-2 text-primary font-semibold mb-2">
                      Team Guides
                    </DropdownMenuLabel>
                    {toolsMenu.teams.map((cat) => (
                      <div key={cat.category} className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 px-2">
                          {cat.category}
                        </div>
                        {cat.items.map((item) => (
                          <DropdownMenuItem key={item.href} asChild className="group">
                            <Link
                              href={item.href}
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => trackNavClick(item.label, item.href, "desktop_team_guides_menu")}
                            >
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
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => trackNavClick(item.label, item.href, "desktop_workflows_menu")}
                    >
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
                onClick={() => trackNavClick(link.label, link.href, "desktop_nav")}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Buttons - hidden below lg */}
          <div className="hidden lg:flex items-center gap-3">
            <Button variant="ghost" size="sm" rounded="full" asChild>
              <Link href="/#how-it-works" onClick={() => trackNavClick("How it works", "/#how-it-works", "desktop_action")}>
                How it works
              </Link>
            </Button>
            <Button size="sm" rounded="full" className="gap-1.5" asChild>
              <Link href="/gemini-spark" onClick={() => trackNavClick("Open Chat", "/gemini-spark", "desktop_action")}>
                Open Chat
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button - visible below lg */}
          <button
            type="button"
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const nextOpen = !mobileMenuOpen
              setMobileMenuOpen(nextOpen)
              captureEvent("mobile_menu_toggled", { open: nextOpen })
            }}
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
                <Link
                  href="/"
                  className="flex items-center gap-2"
                  onClick={() => closeMobileMenuAfterClick("Gemini Spark", "/", "mobile_brand")}
                >
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
                  onClick={() => {
                    setMobileMenuOpen(false)
                    captureEvent("mobile_menu_toggled", { open: false, source: "close_button" })
                  }}
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
                {/* Tools Section */}
                <div className="px-4 py-2 text-xs font-medium text-primary uppercase tracking-wider">Agent Tools</div>
                {toolsMenu.agent.map((cat) => (
                  <div key={cat.category}>
                    <div className="px-4 py-1 text-xs text-muted-foreground">{cat.category}</div>
                    {cat.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-2 px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                        onClick={() => closeMobileMenuAfterClick(item.label, item.href, "mobile_tools_menu")}
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
                  Team Guides
                </div>
                {toolsMenu.teams.map((cat) => (
                  <div key={cat.category}>
                    <div className="px-4 py-1 text-xs text-muted-foreground">{cat.category}</div>
                    {cat.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-2 px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                        onClick={() => closeMobileMenuAfterClick(item.label, item.href, "mobile_team_guides_menu")}
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
                    onClick={() => closeMobileMenuAfterClick(item.label, item.href, "mobile_workflows_menu")}
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
                    onClick={() => closeMobileMenuAfterClick(link.label, link.href, "mobile_nav")}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-border/50 bg-background flex flex-col gap-3">
                <Button variant="ghost" rounded="lg" className="justify-center text-base py-6 w-full" asChild>
                  <Link
                    href="/#how-it-works"
                    onClick={() => closeMobileMenuAfterClick("How it works", "/#how-it-works", "mobile_action")}
                  >
                    How it works
                  </Link>
                </Button>
                <Button rounded="full" className="py-6 text-base w-full" asChild>
                  <Link href="/gemini-spark" onClick={() => closeMobileMenuAfterClick("Open Chat", "/gemini-spark", "mobile_action")}>
                    Open Chat
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
