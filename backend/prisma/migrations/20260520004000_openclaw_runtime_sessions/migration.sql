ALTER TABLE "Task"
  ADD COLUMN "runtimeRunId" TEXT,
  ADD COLUMN "runtimeSessionId" TEXT,
  ADD COLUMN "lastRuntimeEventAt" TIMESTAMP(3);

ALTER TABLE "UserWorkspace"
  ADD COLUMN "runtimeSessionId" TEXT,
  ADD COLUMN "runtimeAgentId" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX "Task_runtimeRunId_idx" ON "Task"("runtimeRunId");
CREATE INDEX "Task_status_lastRuntimeEventAt_idx" ON "Task"("status", "lastRuntimeEventAt");
