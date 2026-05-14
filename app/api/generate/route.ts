import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { createVideoGenerationTask, videoGenerationSchema } from "@/lib/apimart"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const input = videoGenerationSchema.parse(body)
    const result = await createVideoGenerationTask(input)

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: result.status })
    }

    return NextResponse.json({ ok: true, task: result.task })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: error.issues[0]?.message || "Check the generation settings." },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: false, message: "Gemini Spark could not start the video task." }, { status: 500 })
  }
}
