import { auth } from "@/lib/auth"
import { updateChatThread } from "@/lib/project-agents"

import { jsonError } from "../../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    threadId: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to update Gemini Spark chats.", 401)
  }

  const { threadId } = await context.params
  const body = (await request.json().catch(() => ({}))) as { title?: string; archived?: boolean }
  if (body.title !== undefined && body.title.trim().length === 0) {
    return jsonError("Chat title is required.", 400)
  }

  const thread = await updateChatThread(session.user.id, threadId, body)
  if (!thread) {
    return jsonError("Chat not found.", 404)
  }

  return Response.json({ thread })
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to delete Gemini Spark chats.", 401)
  }

  const { threadId } = await context.params
  const thread = await updateChatThread(session.user.id, threadId, { archived: true })
  if (!thread) {
    return jsonError("Chat not found.", 404)
  }

  return Response.json({ thread })
}
