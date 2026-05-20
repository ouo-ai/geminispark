import { Worker } from "bullmq"

import { config } from "./config.js"
import { disconnectPrisma } from "./db.js"
import { createRedisConnection, TASK_QUEUE_NAME } from "./queue.js"
import { processTask, syncRunningOpenClawTasks } from "./tasks.js"
import type { QueuedTaskJob } from "./types.js"

const connection = createRedisConnection()
let syncInFlight = false

const worker = new Worker<QueuedTaskJob>(
  TASK_QUEUE_NAME,
  async (job) => {
    await processTask(job.data.taskId)
  },
  {
    connection,
    concurrency: config.workerConcurrency,
    lockDuration: 10 * 60 * 1000,
  },
)

worker.on("completed", (job) => {
  console.log(`Completed task job ${job.id}`)
})

worker.on("failed", (job, error) => {
  console.error(`Failed task job ${job?.id || "unknown"}:`, error)
})

async function runOpenClawSync() {
  if (syncInFlight) {
    return
  }

  syncInFlight = true
  try {
    const count = await syncRunningOpenClawTasks(config.openClawSyncBatchSize)
    if (count > 0) {
      console.log(`Synced ${count} running Gemini Spark task${count === 1 ? "" : "s"}`)
    }
  } catch (error) {
    console.error("Failed to sync running Gemini Spark tasks:", error)
  } finally {
    syncInFlight = false
  }
}

const syncTimer = setInterval(() => {
  void runOpenClawSync()
}, config.openClawSyncIntervalMs)
void runOpenClawSync()

async function shutdown() {
  console.log("Shutting down Gemini Spark worker")
  if (syncTimer) {
    clearInterval(syncTimer)
  }
  await worker.close()
  await connection.quit()
  await disconnectPrisma()
}

process.once("SIGINT", () => void shutdown().then(() => process.exit(0)))
process.once("SIGTERM", () => void shutdown().then(() => process.exit(0)))
