import { getAgentApiAuthHeaders, getSessionOwnerId, jsonError, requireAgentApiUrl } from "../../proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const ownerId = await getSessionOwnerId(request)
    if (!ownerId) {
      return jsonError("Sign in to chat with Gemini Spark.", 401)
    }

    const { taskId } = await context.params
    const agentApiUrl = requireAgentApiUrl()
    const upstreamUrl = new URL(`${agentApiUrl}/tasks/${encodeURIComponent(taskId)}/events`)
    upstreamUrl.searchParams.set("clientId", ownerId)

    const response = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        ...getAgentApiAuthHeaders(ownerId),
      },
    })

    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({ error: "Task event stream failed." }))
      return Response.json(body, { status: response.status })
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    })
  } catch {
    return jsonError("Task event stream failed. Please try again.", 502)
  }
}
