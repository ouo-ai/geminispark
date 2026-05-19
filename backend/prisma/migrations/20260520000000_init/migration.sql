CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

CREATE TYPE "TaskIntent" AS ENUM ('TEXT', 'IMAGE', 'TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO');

CREATE TYPE "ArtifactKind" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'OTHER');

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "clientTaskId" TEXT,
  "externalUserId" TEXT,
  "sessionId" TEXT,
  "message" TEXT NOT NULL,
  "intent" "TaskIntent" NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT,
  "model" TEXT,
  "input" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskEvent" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Artifact" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "kind" "ArtifactKind" NOT NULL,
  "url" TEXT,
  "text" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_status_createdAt_idx" ON "Task"("status", "createdAt");
CREATE INDEX "Task_sessionId_createdAt_idx" ON "Task"("sessionId", "createdAt");
CREATE INDEX "Task_clientTaskId_idx" ON "Task"("clientTaskId");
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");
CREATE INDEX "Artifact_taskId_createdAt_idx" ON "Artifact"("taskId", "createdAt");

ALTER TABLE "TaskEvent"
  ADD CONSTRAINT "TaskEvent_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Artifact"
  ADD CONSTRAINT "Artifact_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
