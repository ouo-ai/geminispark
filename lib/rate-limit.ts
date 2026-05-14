type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitStore = Map<string, RateLimitEntry>

declare global {
  var geminiSparkRateLimitStore: RateLimitStore | undefined
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")

  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown"
}

export function checkRateLimit(key: string, limit = 3, windowMs = 10 * 60 * 1000) {
  const now = Date.now()
  const store = globalThis.geminiSparkRateLimitStore ?? new Map<string, RateLimitEntry>()
  globalThis.geminiSparkRateLimitStore = store

  for (const [entryKey, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(entryKey)
    }
  }

  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })

    return {
      limited: false,
      retryAfter: 0,
    }
  }

  if (current.count >= limit) {
    return {
      limited: true,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    }
  }

  current.count += 1
  store.set(key, current)

  return {
    limited: false,
    retryAfter: 0,
  }
}
