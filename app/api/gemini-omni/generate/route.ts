import {
  getAgentApiAuthHeaders,
  getSessionOwnerId,
  jsonError,
  proxyJsonResponse,
  requireAgentApiUrl,
} from "@/app/api/gemini-spark/tasks/proxy"
import { getPostHogClient } from "@/lib/posthog-server"

type GenerationMode = "video" | "image" | "image-edit"

type GenerationRequest = {
  mode?: GenerationMode
  prompt: string
  duration?: "4" | "6" | "8" | "10"
  aspectRatio?: "16:9" | "9:16"
  resolution?: "720p" | "1080p" | "4k"
  imageSize?: string
  outputFormat?: "png" | "jpeg"
  imageUrls?: string[]
  seed?: number
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerationRequest
    const prompt = payload.prompt?.trim()
    if (!prompt) {
      return jsonError("Prompt is required.")
    }

    const ownerId = await getSessionOwnerId(request)
    if (!ownerId) {
      return jsonError("Sign in to use the generation studio.", 401)
    }

    const mode: GenerationMode = payload.mode ?? "video"

    const agentApiUrl = requireAgentApiUrl()
    const response = await fetch(`${agentApiUrl}/gemini-omni/generate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...getAgentApiAuthHeaders(ownerId),
      },
      body: JSON.stringify({ ...payload, mode, prompt }),
    })

    getPostHogClient().capture({
      distinctId: ownerId,
      event: "generation_submitted",
      properties: {
        mode,
        duration: payload.duration ?? null,
        resolution: payload.resolution ?? null,
        aspect_ratio: payload.aspectRatio ?? null,
        image_size: payload.imageSize ?? null,
        output_format: payload.outputFormat ?? null,
        image_url_count: payload.imageUrls?.length ?? 0,
      },
    })

    return proxyJsonResponse(response, 202)
  } catch {
    return jsonError("Generation request failed. Please try again.", 502)
  }
}
