-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('ADVANCED', 'REJECTED', 'GHOSTED', 'OFFER', 'PENDING');

-- CreateEnum
CREATE TYPE "KeySource" AS ENUM ('ALOUD', 'USER');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'INVALID', 'EXHAUSTED', 'REVOKED');

-- AlterTable
ALTER TABLE "MockSession" ADD COLUMN     "keySource" "KeySource" NOT NULL DEFAULT 'ALOUD';

-- AlterTable
ALTER TABLE "MockTurn" ADD COLUMN     "clientTurnId" TEXT,
ADD COLUMN     "disfluencyJson" JSONB;

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "result" "InterviewOutcome" NOT NULL DEFAULT 'PENDING',
    "offerLevel" "SignalLevel",
    "note" TEXT,
    "predictedSignal" "SignalLevel",
    "predictedWeakest" TEXT,
    "rubricVersion" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "LlmProvider" NOT NULL DEFAULT 'OPENAI',
    "ciphertextB64" TEXT NOT NULL,
    "ivB64" TEXT NOT NULL,
    "tagB64" TEXT NOT NULL,
    "dekVersion" INTEGER NOT NULL DEFAULT 1,
    "last4" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "label" TEXT,
    "status" "KeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "capabilities" JSONB,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factsJson" JSONB NOT NULL,
    "sourceText" TEXT NOT NULL,
    "rawS3Key" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_sessionId_key" ON "Outcome"("sessionId");

-- CreateIndex
CREATE INDEX "Outcome_userId_capturedAt_idx" ON "Outcome"("userId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "Outcome_result_idx" ON "Outcome"("result");

-- CreateIndex
CREATE INDEX "ProviderKey_userId_idx" ON "ProviderKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderKey_userId_provider_key" ON "ProviderKey"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeProfile_userId_key" ON "ResumeProfile"("userId");

-- CreateIndex
CREATE INDEX "MockTurn_sessionId_clientTurnId_idx" ON "MockTurn"("sessionId", "clientTurnId");

-- AddForeignKey
ALTER TABLE "MockSession" ADD CONSTRAINT "MockSession_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ProviderKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderKey" ADD CONSTRAINT "ProviderKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeProfile" ADD CONSTRAINT "ResumeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

