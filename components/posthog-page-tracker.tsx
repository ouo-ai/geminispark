"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { captureEvent } from "@/lib/posthog-client"

const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"]

function pageviewProperties() {
  const params = new URLSearchParams(window.location.search)
  const campaign: Record<string, string | boolean | string[]> = {
    has_prompt_param: params.has("prompt"),
    search_param_keys: Array.from(params.keys()),
  }

  for (const key of CAMPAIGN_PARAMS) {
    const value = params.get(key)
    if (value) {
      campaign[key] = value
    }
  }

  return campaign
}

export function PostHogPageTracker() {
  const pathname = usePathname()
  const lastTrackedUrl = useRef("")

  useEffect(() => {
    const sanitizedUrl = `${window.location.origin}${window.location.pathname}`
    if (lastTrackedUrl.current === sanitizedUrl) {
      return
    }

    lastTrackedUrl.current = sanitizedUrl
    captureEvent("$pageview", pageviewProperties())
  }, [pathname])

  return null
}
