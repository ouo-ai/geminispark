import { Queue } from "bullmq"
import IORedis from "ioredis"

import { config } from "./config.js"
import type { QueuedTaskJob } from "./types.js"

export const TASK_QUEUE_NAME = "geminispark-agent-tasks"

export function createRedisConnection() {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

let taskQueue: Queue<QueuedTaskJob> | undefined

export function getTaskQueue() {
  if (!taskQueue) {
    taskQueue = new Queue<QueuedTaskJob>(TASK_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 10_000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 5000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
          count: 10000,
        },
      },
    })
  }

  return taskQueue
}

export async function closeTaskQueue() {
  if (!taskQueue) {
    return
  }

  await taskQueue.close()
  const client = await taskQueue.client
  if (client.status !== "end") {
    await client.quit()
  }
  taskQueue = undefined
}
