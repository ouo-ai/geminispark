import { getAgentApiAuthHeaders, getSessionOwnerId, jsonError, proxyJsonResponse, requireAgentApiUrl } from "../proxy"

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
    const response = await fetch(`${agentApiUrl}/tasks/${encodeURIComponent(taskId)}`, {
      headers: {
        Accept: "application/json",
        ...getAgentApiAuthHeaders(ownerId),
      },
    })

    return proxyJsonResponse(response)
  } catch {
    return jsonError("Task request failed. Please try again.", 502)
  }
}
