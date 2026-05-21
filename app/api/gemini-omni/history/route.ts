import {
  getAgentApiAuthHeaders,
  getSessionOwnerId,
  jsonError,
  proxyJsonResponse,
  requireAgentApiUrl,
} from "@/app/api/gemini-spark/tasks/proxy"

export async function GET(request: Request) {
  try {
    const ownerId = await getSessionOwnerId(request)
    if (!ownerId) {
      return jsonError("Sign in to view generation history.", 401)
    }

    const agentApiUrl = requireAgentApiUrl()
    const response = await fetch(`${agentApiUrl}/gemini-omni/history`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getAgentApiAuthHeaders(ownerId),
      },
    })

    return proxyJsonResponse(response)
  } catch {
    return jsonError("Failed to load generation history.", 502)
  }
}
