import { auth } from "@/lib/auth"
import { createProjectAgent, ensureDefaultProjectBundle } from "@/lib/project-agents"

import { jsonError } from "../tasks/proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to manage Gemini Spark projects.", 401)
  }

  const bundle = await ensureDefaultProjectBundle(session.user.id)
  return Response.json(bundle)
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user.id) {
    return jsonError("Sign in to create Gemini Spark projects.", 401)
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string }
  const created = await createProjectAgent(session.user.id, body.name)
  return Response.json(created, { status: 201 })
}
