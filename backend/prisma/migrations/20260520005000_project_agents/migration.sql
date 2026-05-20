-- Project Agent long-term multi-session architecture.

ALTER TABLE "Task"
  ADD COLUMN "projectAgentId" TEXT,
  ADD COLUMN "chatThreadId" TEXT;

CREATE TABLE "UserProfile" (
  "userId" TEXT NOT NULL,
  "nickname" TEXT,
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "preferences" JSONB,
  "memorySummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ProjectAgent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkspaceStatus" NOT NULL DEFAULT 'PENDING',
  "workspaceId" TEXT,
  "runtimeAgentId" TEXT,
  "memorySummary" TEXT,
  "instructions" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatThread" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectAgentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_projectAgentId_createdAt_idx" ON "Task"("projectAgentId", "createdAt");
CREATE INDEX "Task_chatThreadId_createdAt_idx" ON "Task"("chatThreadId", "createdAt");
CREATE INDEX "ProjectAgent_userId_archivedAt_updatedAt_idx" ON "ProjectAgent"("userId", "archivedAt", "updatedAt");
CREATE INDEX "ProjectAgent_workspaceId_idx" ON "ProjectAgent"("workspaceId");
CREATE INDEX "ChatThread_userId_projectAgentId_updatedAt_idx" ON "ChatThread"("userId", "projectAgentId", "updatedAt");
CREATE INDEX "ChatThread_projectAgentId_archivedAt_updatedAt_idx" ON "ChatThread"("projectAgentId", "archivedAt", "updatedAt");

ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAgent"
  ADD CONSTRAINT "ProjectAgent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatThread"
  ADD CONSTRAINT "ChatThread_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatThread"
  ADD CONSTRAINT "ChatThread_projectAgentId_fkey"
  FOREIGN KEY ("projectAgentId") REFERENCES "ProjectAgent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_projectAgentId_fkey"
  FOREIGN KEY ("projectAgentId") REFERENCES "ProjectAgent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_chatThreadId_fkey"
  FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
