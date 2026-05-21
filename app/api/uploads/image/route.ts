import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getPostHogClient } from "@/lib/posthog-server"
import { presignPutUrl, R2NotConfiguredError } from "@/lib/r2"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 20 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function pickExtension(filename: string | undefined, contentType: string) {
  const fromType = EXT_BY_TYPE[contentType.toLowerCase()]
  if (fromType) return fromType
  const fromName = filename?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  if (fromName && ["png", "jpg", "jpeg", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName
  }
  return null
}

type SignRequest = {
  filename?: string
  contentType?: string
  size?: number
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    const userId = session?.user.id
    if (!userId) {
      return jsonError("Sign in to upload.", 401)
    }

    const body = (await request.json().catch(() => null)) as SignRequest | null
    if (!body) {
      return jsonError("Invalid request body.")
    }

    const contentType = (body.contentType || "").toLowerCase()
    if (!contentType.startsWith("image/")) {
      return jsonError("Only image uploads are allowed.", 415)
    }

    const size = typeof body.size === "number" ? body.size : 0
    if (size <= 0) {
      return jsonError("File size is required.")
    }
    if (size > MAX_BYTES) {
      return jsonError("File too large (max 20MB).", 413)
    }

    const ext = pickExtension(body.filename, contentType)
    if (!ext) {
      return jsonError("Unsupported image format (use png / jpg / webp / gif).", 415)
    }

    const key = `uploads/${userId}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`
    const presigned = presignPutUrl({ key, contentType, expiresSeconds: 600 })

    getPostHogClient().capture({
      distinctId: userId,
      event: "image_upload_signed",
      properties: { size_bytes: size, mime_type: contentType, ext },
    })

    return NextResponse.json({
      url: presigned.url,
      publicUrl: presigned.publicUrl,
      headers: presigned.headers,
      key: presigned.key,
      expiresAt: presigned.expiresAt,
    })
  } catch (error) {
    if (error instanceof R2NotConfiguredError) {
      return jsonError("Storage is not configured.", 500)
    }
    const message = error instanceof Error ? error.message : "Failed to sign upload."
    return jsonError(message, 502)
  }
}
