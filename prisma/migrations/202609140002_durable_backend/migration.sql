-- DropIndex
DROP INDEX "ContractEvent_contractId_createdAt_idx";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "activeRunId" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fixture" TEXT,
ADD COLUMN     "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'fixture',
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deadlineAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + interval '30 minutes'),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "fieldChanges" TEXT,
ADD COLUMN     "healAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMP(3),
ADD COLUMN     "providerJobId" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'queued';

-- AlterTable
ALTER TABLE "ContractEvent" ADD COLUMN     "runId" TEXT,
ADD COLUMN     "sequence" BIGSERIAL NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'session',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAttempt" (
    "stateHash" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("stateHash")
);

-- CreateTable
CREATE TABLE "RepairAttempt" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "proposal" TEXT,
    "violations" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairAttempt_runId_attempt_key" ON "RepairAttempt"("runId", "attempt");

-- Legacy mock IDs were derived from the URL and may be duplicated. These
-- unowned collectors require explicit reassignment before live use.
UPDATE "Contract" SET "collectorId" = NULL WHERE "collectorId" LIKE 'c_mock_%';

-- CreateIndex
CREATE UNIQUE INDEX "Contract_collectorId_key" ON "Contract"("collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_activeRunId_key" ON "Contract"("activeRunId");

-- CreateIndex
CREATE INDEX "Contract_ownerId_createdAt_idx" ON "Contract"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_enabled_nextRunAt_idx" ON "Contract"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "Run_finishedAt_availableAt_leaseUntil_idx" ON "Run"("finishedAt", "availableAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Run_contractId_idempotencyKey_key" ON "Run"("contractId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContractEvent_sequence_key" ON "ContractEvent"("sequence");

-- CreateIndex
CREATE INDEX "ContractEvent_contractId_sequence_idx" ON "ContractEvent"("contractId", "sequence");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairAttempt" ADD CONSTRAINT "RepairAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preserve legacy history but never automatically run unowned contracts.
UPDATE "Contract" SET "enabled" = false WHERE "ownerId" IS NULL;
UPDATE "Run" SET "state" = COALESCE("outcome", 'failed'), "outcome" = COALESCE("outcome", 'failed'), "finishedAt" = COALESCE("finishedAt", CURRENT_TIMESTAMP), "error" = CASE WHEN "finishedAt" IS NULL THEN 'Legacy in-process run interrupted before migration' ELSE "error" END;
