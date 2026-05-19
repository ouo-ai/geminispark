import { TaskIntent } from "@prisma/client"

import type { AgentIntent, ClientAttachment } from "./types.js"

const generationWords = [
  "generate",
  "create",
  "make",
  "draw",
  "design",
  "render",
  "poster",
  "logo",
  "image",
  "picture",
  "photo",
  "illustration",
  "visual",
  "生成",
  "画",
  "图片",
  "海报",
  "照片",
  "插画",
]

const videoWords = [
  "video",
  "clip",
  "movie",
  "reel",
  "short",
  "animate",
  "animation",
  "motion",
  "cinematic",
  "camera",
  "视频",
  "动画",
  "运镜",
  "短片",
]

function hasAnyWord(input: string, words: string[]) {
  const text = input.toLowerCase()
  return words.some((word) => text.includes(word))
}

export function selectIntent(message: string, attachments: ClientAttachment[] = []): AgentIntent {
  const hasImage = attachments.some((attachment) => attachment.type.startsWith("image/"))
  const wantsVideo = hasAnyWord(message, videoWords)
  const wantsImage = hasAnyWord(message, generationWords)

  if (wantsVideo && hasImage) {
    return "image-to-video"
  }

  if (wantsVideo) {
    return "text-to-video"
  }

  if (wantsImage) {
    return "image"
  }

  return "text"
}

export function toDbIntent(intent: AgentIntent) {
  if (intent === "image") {
    return TaskIntent.IMAGE
  }

  if (intent === "text-to-video") {
    return TaskIntent.TEXT_TO_VIDEO
  }

  if (intent === "image-to-video") {
    return TaskIntent.IMAGE_TO_VIDEO
  }

  return TaskIntent.TEXT
}

export function fromDbIntent(intent: TaskIntent): AgentIntent {
  if (intent === TaskIntent.IMAGE) {
    return "image"
  }

  if (intent === TaskIntent.TEXT_TO_VIDEO) {
    return "text-to-video"
  }

  if (intent === TaskIntent.IMAGE_TO_VIDEO) {
    return "image-to-video"
  }

  return "text"
}
