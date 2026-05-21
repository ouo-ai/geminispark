"use client"

import posthog from "posthog-js"

export type AnalyticsProperties = Record<string, unknown>

function sanitizedCurrentUrl() {
  if (typeof window === "undefined") {
    return undefined
  }

  return `${window.location.origin}${window.location.pathname}`
}

function currentPageProperties() {
  if (typeof window === "undefined") {
    return {}
  }

  return {
    $current_url: sanitizedCurrentUrl(),
    page_path: window.location.pathname,
    page_hash: window.location.hash || undefined,
    page_search_keys: Array.from(new URLSearchParams(window.location.search).keys()),
  }
}

function canCapture() {
  return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN)
}

export function captureEvent(event: string, properties: AnalyticsProperties = {}) {
  if (!canCapture()) {
    return
  }

  try {
    posthog.capture(event, {
      ...currentPageProperties(),
      ...properties,
    })
  } catch {
    // Analytics should never break product flows.
  }
}

export function captureAnalyticsException(error: unknown, properties: AnalyticsProperties = {}) {
  if (!canCapture()) {
    return
  }

  try {
    posthog.captureException(error, {
      ...currentPageProperties(),
      ...properties,
    })
  } catch {
    // Analytics should never break product flows.
  }
}

export function identifyAnalyticsUser(
  userId: string,
  properties: {
    email?: string | null
    name?: string | null
  } = {},
) {
  if (!canCapture()) {
    return
  }

  try {
    posthog.identify(userId, {
      email: properties.email || undefined,
      name: properties.name || undefined,
    })
  } catch {
    // Analytics should never break product flows.
  }
}

export function resetAnalyticsUser() {
  if (!canCapture()) {
    return
  }

  try {
    posthog.reset()
  } catch {
    // Analytics should never break product flows.
  }
}
