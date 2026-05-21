import {
  getAgentApiAuthHeaders,
  getSessionOwnerId,
  jsonError,
  proxyJsonResponse,
  requireAgentApiUrl,
} from "@/app/api/gemini-spark/tasks/proxy"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const ownerId = await getSessionOwnerId(request)
    if (!ownerId) {
      return jsonError("Sign in to view this task.", 401)
    }

    const { taskId } = await context.params
    const agentApiUrl = requireAgentApiUrl()
    const response = await fetch(`${agentApiUrl}/gemini-omni/${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getAgentApiAuthHeaders(ownerId),
      },
    })

    return proxyJsonResponse(response)
  } catch {
    return jsonError("Failed to refresh task status.", 502)
  }
}
