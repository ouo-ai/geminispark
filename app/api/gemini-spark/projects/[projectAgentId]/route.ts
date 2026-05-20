import { auth } from "@/lib/auth"
import { updateProjectAgent } from "@/lib/project-agents"

import { jsonError } from "../../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    projectAgentId: string
  }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to update Gemini Spark projects.", 401)
  }

  const { projectAgentId } = await context.params
  const body = (await request.json().catch(() => ({}))) as { name?: string; archived?: boolean }
  if (body.name !== undefined && body.name.trim().length === 0) {
    return jsonError("Project name is required.", 400)
  }

  const project = await updateProjectAgent(session.user.id, projectAgentId, body)
  if (!project) {
    return jsonError("Project not found.", 404)
  }

  return Response.json({ project })
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to delete Gemini Spark projects.", 401)
  }

  const { projectAgentId } = await context.params
  const project = await updateProjectAgent(session.user.id, projectAgentId, { archived: true })
  if (!project) {
    return jsonError("Project not found.", 404)
  }

  return Response.json({ project })
}
