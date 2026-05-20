import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { join } from "node:path"

const PORT = Number(process.env.PORT || process.env.OPENCLAW_GATEWAY_PORT || 8787)
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "/srv/openclaw/workspaces"
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const APIMART_API_KEY = process.env.APIMART_API_KEY || ""
const EGGAPI_API_KEY = process.env.EGGAPI_API_KEY || ""
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || ""
const OPENCLAW_DEFAULT_MODEL = process.env.OPENCLAW_DEFAULT_MODEL || "anthropic/claude-opus-4.7"
const APIMART_IMAGE_MODEL = process.env.APIMART_IMAGE_MODEL || "gpt-image-2"
const EGG_TEXT_TO_VIDEO_MODEL = process.env.EGG_TEXT_TO_VIDEO_MODEL || "alibaba/wan-2.7/text-to-video"
const EGG_IMAGE_TO_VIDEO_MODEL = process.env.EGG_IMAGE_TO_VIDEO_MODEL || "alibaba/wan-2.7/image-to-video"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://geminispark.ai"
const MEDIA_POLL_TIMEOUT_MS = Number(process.env.MEDIA_POLL_TIMEOUT_MS || 600_000)
const MEDIA_POLL_INTERVAL_MS = Number(process.env.MEDIA_POLL_INTERVAL_MS || 5_000)

const runs = new Map()

function json(response, statusCode, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  })
  response.end(body)
}

function unauthorized(response) {
  return json(response, 401, { error: "Unauthorized." })
}

function isAuthorized(request) {
  if (!OPENCLAW_GATEWAY_TOKEN) {
    return false
  }

  const expected = Buffer.from(`Bearer ${OPENCLAW_GATEWAY_TOKEN}`)
  const received = Buffer.from(request.headers.authorization || "")
  return received.length === expected.length && timingSafeEqual(received, expected)
}

function workspaceIdForUser(userId) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32)
}

function workspacePath(workspaceId) {
  return join(WORKSPACE_ROOT, workspaceId)
}

function runPath(workspaceId, runId) {
  return join(workspacePath(workspaceId), "runs", `${runId}.json`)
}

function globalRunPath(runId) {
  return join(WORKSPACE_ROOT, "_runs", `${runId}.json`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const text = Buffer.concat(chunks).toString("utf8")
  return text ? JSON.parse(text) : {}
}

async function ensureWorkspace(userId) {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId is required.")
  }

  const workspaceId = workspaceIdForUser(userId)
  const root = workspacePath(workspaceId)
  await mkdir(join(root, "runs"), { recursive: true })
  await writeFile(
    join(root, "workspace.json"),
    JSON.stringify(
      {
        workspaceId,
        userHash: workspaceId,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  return workspaceId
}

function normalizeIntent(value) {
  if (value === "image" || value === "text-to-video" || value === "image-to-video") {
    return value
  }

  return "text"
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .filter((message) => message && (message.role === "assistant" || message.role === "user") && typeof message.body === "string")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.body,
    }))
}

function attachmentUrl(attachment) {
  return typeof attachment?.url === "string" && attachment.url
    ? attachment.url
    : typeof attachment?.dataUrl === "string"
      ? attachment.dataUrl
      : ""
}

function imageAttachmentUrls(attachments, limit) {
  if (!Array.isArray(attachments)) {
    return []
  }

  return attachments
    .filter((attachment) => typeof attachment?.type === "string" && attachment.type.startsWith("image/") && attachmentUrl(attachment))
    .slice(0, limit)
    .map(attachmentUrl)
}

function extractUrls(body) {
  const urls = new Set()

  function visit(value) {
    if (!value) {
      return
    }

    if (typeof value === "string") {
      if (/^https?:\/\//.test(value) || value.startsWith("data:")) {
        urls.add(value)
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (typeof value === "object") {
      Object.values(value).forEach(visit)
    }
  }

  visit(body)
  return Array.from(urls)
}

function findTaskId(body) {
  if (!body || typeof body !== "object") {
    return ""
  }

  const data = body.data
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0].task_id || data[0].taskId || data[0].id || ""
  }

  if (data && typeof data === "object") {
    return data.task_id || data.taskId || data.id || ""
  }

  return body.task_id || body.taskId || body.id || ""
}

function isVideoUrl(url) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url)
}

async function parseProviderResponse(response) {
  const text = await response.text()
  let body = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  if (!response.ok) {
    const message = body && typeof body === "object" && body.error ? JSON.stringify(body.error) : text || response.statusText
    throw new Error(message)
  }

  return body
}

async function saveRun(run) {
  runs.set(run.runId, run)
  await mkdir(join(workspacePath(run.workspaceId), "runs"), { recursive: true })
  await mkdir(join(WORKSPACE_ROOT, "_runs"), { recursive: true })
  await writeFile(runPath(run.workspaceId, run.runId), JSON.stringify(run, null, 2))
  await writeFile(globalRunPath(run.runId), JSON.stringify(run, null, 2))
}

async function addEvent(run, type, message, data = {}) {
  const event = {
    id: randomUUID(),
    type,
    message,
    data,
    createdAt: new Date().toISOString(),
  }
  run.events.push(event)
  run.updatedAt = event.createdAt
  await saveRun(run)
  return event
}

async function loadRun(runId) {
  const cached = runs.get(runId)
  if (cached) {
    return cached
  }

  try {
    const raw = await readFile(globalRunPath(runId), "utf8")
    const parsed = JSON.parse(raw)
    runs.set(runId, parsed)
    return parsed
  } catch {
    return null
  }
}

async function callOpenRouter(payload) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.")
  }

  const imageParts = imageAttachmentUrls(payload.attachments, 4).map((url) => ({
    type: "image_url",
    image_url: {
      url,
      detail: "auto",
    },
  }))
  const userContent = imageParts.length > 0 ? [{ type: "text", text: payload.message }, ...imageParts] : payload.message

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL,
      "X-OpenRouter-Title": "Gemini Spark Gateway",
    },
    body: JSON.stringify({
      model: payload.model || OPENCLAW_DEFAULT_MODEL,
      temperature: 0.6,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You are Gemini Spark, an agent running inside an isolated user workspace. Never describe yourself as OpenClaw to the user. Complete the user's task clearly, keep outputs actionable, and do not expose hidden reasoning.",
        },
        ...normalizeHistory(payload.history),
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  })

  const body = await parseProviderResponse(response)
  return {
    message: body?.choices?.[0]?.message?.content || "Gemini Spark returned an empty response.",
    model: body?.model || payload.model || OPENCLAW_DEFAULT_MODEL,
  }
}

async function pollApimartTask(taskId) {
  const started = Date.now()
  let latest = null

  while (Date.now() - started < MEDIA_POLL_TIMEOUT_MS) {
    await sleep(MEDIA_POLL_INTERVAL_MS)

    const response = await fetch(`https://api.apimart.ai/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${APIMART_API_KEY}`,
      },
    })
    latest = await parseProviderResponse(response)
    const urls = extractUrls(latest)
    const status = latest?.data?.status || latest?.status

    if (urls.length > 0 || status === "completed" || status === "failed") {
      return latest
    }
  }

  return latest
}

async function callApimartImage(payload) {
  if (!APIMART_API_KEY) {
    throw new Error("APIMART_API_KEY is not configured.")
  }

  const imageUrls = imageAttachmentUrls(payload.attachments, 8)
  const response = await fetch("https://api.apimart.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${APIMART_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: APIMART_IMAGE_MODEL,
      prompt: payload.message,
      n: 1,
      size: "auto",
      resolution: "1k",
      ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
    }),
  })

  const submitted = await parseProviderResponse(response)
  const providerTaskId = findTaskId(submitted)
  const finalBody = providerTaskId ? await pollApimartTask(providerTaskId) : submitted
  const urls = extractUrls(finalBody || submitted).filter((url) => !isVideoUrl(url))
  return { providerTaskId, urls }
}

async function pollEggTask(taskId) {
  const endpoints = [`https://api.eggapi.ai/v1/tasks/${taskId}`, `https://api.eggapi.ai/v1/generate/${taskId}`]
  const started = Date.now()
  let latest = null

  while (Date.now() - started < MEDIA_POLL_TIMEOUT_MS) {
    await sleep(MEDIA_POLL_INTERVAL_MS)

    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${EGGAPI_API_KEY}`,
        },
      })

      if (response.status === 404 || response.status === 405) {
        continue
      }

      latest = await parseProviderResponse(response)
      const urls = extractUrls(latest)
      const text = JSON.stringify(latest).toLowerCase()

      if (urls.length > 0 || text.includes("completed") || text.includes("failed") || text.includes("succeeded")) {
        return latest
      }
    }
  }

  return latest
}

async function callEggVideo(intent, payload) {
  if (!EGGAPI_API_KEY) {
    throw new Error("EGGAPI_API_KEY is not configured.")
  }

  const imageUrls = imageAttachmentUrls(payload.attachments, 1)
  const model = intent === "image-to-video" ? EGG_IMAGE_TO_VIDEO_MODEL : EGG_TEXT_TO_VIDEO_MODEL
  const response = await fetch("https://api.eggapi.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EGGAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: payload.message,
      negative_prompt: "blurry, low quality, watermark, text, distortion, extra limbs",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      parameters: {
        generate_audio: true,
        enable_web_search: false,
      },
      ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
    }),
  })

  const submitted = await parseProviderResponse(response)
  const providerTaskId = findTaskId(submitted)
  const finalBody = providerTaskId ? await pollEggTask(providerTaskId) : submitted
  const urls = extractUrls(finalBody || submitted)
  return { providerTaskId, urls }
}

async function executeRun(run, payload) {
  try {
    const intent = normalizeIntent(payload.intent)
    await addEvent(run, "workspace_ready", "Gemini Spark workspace is ready.", {
      workspaceId: run.workspaceId,
      progress: 15,
    })
    await addEvent(run, "model_selected", "Gemini Spark selected Claude Opus 4.7.", {
      model: payload.model || OPENCLAW_DEFAULT_MODEL,
      progress: 20,
    })

    if (intent === "text") {
      await addEvent(run, "tool_selected", "Gemini Spark selected the text reasoning tool.", {
        tool: "openrouter_chat",
        progress: 30,
      })
      const result = await callOpenRouter(payload)
      run.status = "succeeded"
      run.intent = intent
      run.message = result.message
      run.model = result.model
      run.artifacts = [{ type: "text", text: run.message }]
      await addEvent(run, "completed", "Gemini Spark completed the response.", { progress: 100 })
    } else if (intent === "image") {
      await addEvent(run, "tool_selected", "Gemini Spark selected the image generation tool.", {
        tool: "apimart_image",
        progress: 30,
      })
      await addEvent(run, "provider_submitted", "Gemini Spark submitted the image job.", {
        provider: "APIMart",
        progress: 45,
      })
      const result = await callApimartImage(payload)
      if (!result.urls.length) {
        throw new Error("APIMart did not return an image artifact before timeout.")
      }

      run.status = "succeeded"
      run.intent = intent
      run.message = "Gemini Spark generated an image artifact."
      run.model = APIMART_IMAGE_MODEL
      run.providerTaskId = result.providerTaskId || undefined
      run.artifacts = [
        { type: "text", text: run.message },
        ...result.urls.map((url) => ({ type: "image", url })),
      ]
      await addEvent(run, "artifact_ready", "Gemini Spark received the image artifact.", {
        provider: "APIMart",
        providerTaskId: result.providerTaskId || undefined,
        artifactType: "image",
        artifactUrl: result.urls[0],
        progress: 90,
      })
      await addEvent(run, "completed", "Gemini Spark completed the image task.", { progress: 100 })
    } else {
      await addEvent(run, "tool_selected", "Gemini Spark selected the video generation tool.", {
        tool: intent === "image-to-video" ? "eggapi_image_to_video" : "eggapi_text_to_video",
        progress: 30,
      })
      await addEvent(run, "provider_submitted", "Gemini Spark submitted the video job.", {
        provider: "EggAPI",
        progress: 45,
      })
      const result = await callEggVideo(intent, payload)
      if (!result.urls.length) {
        throw new Error("EggAPI did not return a video artifact before timeout.")
      }

      run.status = "succeeded"
      run.intent = intent
      run.message = "Gemini Spark generated a video artifact."
      run.model = intent === "image-to-video" ? EGG_IMAGE_TO_VIDEO_MODEL : EGG_TEXT_TO_VIDEO_MODEL
      run.providerTaskId = result.providerTaskId || undefined
      run.artifacts = [
        { type: "text", text: run.message },
        ...result.urls.map((url) => ({ type: "video", url })),
      ]
      await addEvent(run, "artifact_ready", "Gemini Spark received the video artifact.", {
        provider: "EggAPI",
        providerTaskId: result.providerTaskId || undefined,
        artifactType: "video",
        artifactUrl: result.urls[0],
        progress: 90,
      })
      await addEvent(run, "completed", "Gemini Spark completed the video task.", { progress: 100 })
    }

    run.finishedAt = new Date().toISOString()
    run.updatedAt = run.finishedAt
    await saveRun(run)
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message.replace(/\bOpenClaw\b/g, "Gemini Spark") : "Gemini Spark run failed."
    run.finishedAt = new Date().toISOString()
    run.updatedAt = run.finishedAt
    await addEvent(run, "failed", run.error, { progress: 100 })
    await saveRun(run)
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`)

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
        ok: true,
        service: "geminispark-openclaw-gateway",
        time: new Date().toISOString(),
      })
    }

    if (!isAuthorized(request)) {
      return unauthorized(response)
    }

    if (request.method === "POST" && url.pathname === "/workspaces") {
      const body = await readJson(request)
      const workspaceId = await ensureWorkspace(body.userId)
      return json(response, 200, {
        workspaceId,
        status: "ready",
        initializedAt: new Date().toISOString(),
      })
    }

    if (request.method === "POST" && url.pathname === "/runs") {
      const body = await readJson(request)
      const workspaceId = await ensureWorkspace(body.userId)
      if (body.workspaceId && body.workspaceId !== workspaceId) {
        return json(response, 403, { error: "Workspace does not belong to user." })
      }

      const run = {
        runId: randomUUID(),
        taskId: body.taskId,
        userId: body.userId,
        workspaceId,
        intent: normalizeIntent(body.intent),
        status: "running",
        model: body.model || OPENCLAW_DEFAULT_MODEL,
        message: "",
        artifacts: [],
        events: [
          {
            id: randomUUID(),
            type: "run_created",
            message: "Gemini Spark run created.",
            data: { intent: normalizeIntent(body.intent), workspaceId, progress: 10 },
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await saveRun(run)
      void executeRun(run, body)
      return json(response, 202, {
        runId: run.runId,
        status: run.status,
        intent: run.intent,
        events: run.events,
      })
    }

    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/)
    if (request.method === "GET" && runMatch) {
      const run = await loadRun(runMatch[1])
      if (!run) {
        return json(response, 404, { error: "Run not found." })
      }

      return json(response, 200, run)
    }

    return json(response, 404, { error: "Not found." })
  } catch (error) {
    return json(response, 500, {
      error: error instanceof Error ? error.message : "Internal server error.",
    })
  }
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Gemini Spark Gateway listening on ${PORT}`)
})
