CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'STARTUP', 'PRO');
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID');
CREATE TYPE "CreditBucket" AS ENUM ('FREE', 'PERIOD');
CREATE TYPE "CreditTransactionType" AS ENUM ('GRANT', 'DEBIT', 'REFUND');
CREATE TYPE "WorkspaceStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

ALTER TABLE "Task"
  ADD COLUMN "creditCost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditBucket" "CreditBucket",
  ADD COLUMN "workspaceId" TEXT;

CREATE TABLE "UserCredit" (
  "userId" TEXT NOT NULL,
  "freeCreditsRemaining" INTEGER NOT NULL DEFAULT 2,
  "periodCreditsRemaining" INTEGER NOT NULL DEFAULT 0,
  "plan" "BillingPlan" NOT NULL DEFAULT 'FREE',
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "creditsPeriodStart" TIMESTAMP(3),
  "creditsPeriodEnd" TIMESTAMP(3),
  "nextCreditGrantAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCredit_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT,
  "type" "CreditTransactionType" NOT NULL,
  "bucket" "CreditBucket",
  "amount" INTEGER NOT NULL,
  "balanceAfterFree" INTEGER NOT NULL,
  "balanceAfterPeriod" INTEGER NOT NULL,
  "description" TEXT,
  "stripeEventId" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserWorkspace" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openclaw',
  "workspaceId" TEXT NOT NULL,
  "status" "WorkspaceStatus" NOT NULL DEFAULT 'PENDING',
  "initializedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCredit_stripeCustomerId_key" ON "UserCredit"("stripeCustomerId");
CREATE UNIQUE INDEX "UserCredit_stripeSubscriptionId_key" ON "UserCredit"("stripeSubscriptionId");
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_taskId_idx" ON "CreditTransaction"("taskId");
CREATE INDEX "CreditTransaction_stripeEventId_idx" ON "CreditTransaction"("stripeEventId");
CREATE UNIQUE INDEX "UserWorkspace_userId_provider_key" ON "UserWorkspace"("userId", "provider");
CREATE UNIQUE INDEX "UserWorkspace_provider_workspaceId_key" ON "UserWorkspace"("provider", "workspaceId");
CREATE INDEX "UserWorkspace_status_updatedAt_idx" ON "UserWorkspace"("status", "updatedAt");
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

ALTER TABLE "UserCredit"
  ADD CONSTRAINT "UserCredit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWorkspace"
  ADD CONSTRAINT "UserWorkspace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
