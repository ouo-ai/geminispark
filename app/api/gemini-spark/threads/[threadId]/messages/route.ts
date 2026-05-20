import { auth } from "@/lib/auth"
import { getThreadMessagesForUser } from "@/lib/chat-history"

import { jsonError } from "../../../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    threadId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to load Gemini Spark chats.", 401)
  }

  const { threadId } = await context.params
  const messages = await getThreadMessagesForUser(session.user.id, threadId)
  if (!messages) {
    return jsonError("Chat not found.", 404)
  }

  return Response.json({ messages })
}
