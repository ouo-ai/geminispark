import { NextResponse } from "next/server"

import { getVideoGenerationTask } from "@/lib/apimart"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params

  if (!/^[a-zA-Z0-9_.:-]+$/.test(taskId)) {
    return NextResponse.json({ ok: false, message: "Invalid task id." }, { status: 400 })
  }

  const result = await getVideoGenerationTask(taskId)

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status })
  }

  return NextResponse.json({ ok: true, task: result.task })
}
