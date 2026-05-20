import { auth } from "@/lib/auth"
import { createChatThread } from "@/lib/project-agents"

import { jsonError } from "../../../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    projectAgentId: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to create Gemini Spark chats.", 401)
  }

  const { projectAgentId } = await context.params
  const body = (await request.json().catch(() => ({}))) as { title?: string }
  const thread = await createChatThread(session.user.id, projectAgentId, body.title)
  if (!thread) {
    return jsonError("Project not found.", 404)
  }

  return Response.json({ thread }, { status: 201 })
}
