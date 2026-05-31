-- CreateEnum
CREATE TYPE "SignalLevel" AS ENUM ('NEW_GRAD', 'SDE_II', 'SENIOR');

-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING_VERBAL', 'HIRING_MANAGER', 'BAR_RAISER_PANEL');

-- CreateEnum
CREATE TYPE "ScenarioDifficulty" AS ENUM ('WARMUP', 'CALIBRATED', 'ADVERSARIAL');

-- CreateEnum
CREATE TYPE "MockStatus" AS ENUM ('PENDING', 'LIVE', 'DEBRIEF', 'COMPLETED', 'ABANDONED', 'FAILED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "ScoreDimension" AS ENUM ('LP', 'STAR_STRUCTURE', 'TECHNICAL_DEPTH', 'COMMUNICATION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "DrillStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "targetLevel" "SignalLevel" NOT NULL DEFAULT 'NEW_GRAD';

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL,
    "difficulty" "ScenarioDifficulty" NOT NULL,
    "targetLevel" "SignalLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "lpFocus" TEXT[],
    "estMinutes" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelSeat" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "seatOrder" INTEGER NOT NULL,
    "personaName" TEXT NOT NULL,
    "ownedLPs" TEXT[],
    "isBarRaiser" BOOLEAN NOT NULL DEFAULT false,
    "voice" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,

    CONSTRAINT "PanelSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "apiKeyId" TEXT,
    "provider" "LlmProvider" NOT NULL DEFAULT 'OPENAI',
    "modelUsed" TEXT NOT NULL,
    "judgeModel" TEXT,
    "status" "MockStatus" NOT NULL DEFAULT 'PENDING',
    "targetLevel" "SignalLevel" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "transcriptKey" TEXT,
    "audioOptIn" BOOLEAN NOT NULL DEFAULT false,
    "audioKey" TEXT,
    "overallSignal" "SignalLevel",
    "confidence" INTEGER,
    "passed" BOOLEAN,
    "reportJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seatId" TEXT,
    "role" "PracticeTurnRole" NOT NULL,
    "seq" INTEGER NOT NULL,
    "transcript" TEXT,
    "metricsJson" JSONB,
    "events" JSONB,
    "transcriptionMissing" BOOLEAN NOT NULL DEFAULT false,
    "audioStartMs" INTEGER,
    "audioEndMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionScore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seatId" TEXT,
    "dimension" "ScoreDimension" NOT NULL DEFAULT 'LP',
    "key" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "signalLevel" "SignalLevel" NOT NULL,
    "evidence" TEXT NOT NULL,
    "gap" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DimensionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelVerdict" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "overallSignal" "SignalLevel" NOT NULL,
    "inclination" TEXT NOT NULL,
    "barRaiserVeto" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT NOT NULL,
    "seatRollup" JSONB NOT NULL,
    "topStrengths" TEXT[],
    "topRisks" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfidenceMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "score" INTEGER NOT NULL,
    "composure" INTEGER NOT NULL,
    "resilience" INTEGER,
    "selfEfficacy" INTEGER,
    "difficultyApplied" INTEGER,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidenceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceSessionId" TEXT,
    "questionId" TEXT NOT NULL,
    "targetLP" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DrillStatus" NOT NULL DEFAULT 'ASSIGNED',
    "resultSessionId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DrillAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgmentJob" (
    "sessionId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgmentJob_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateTable
CREATE TABLE "GlobalSpend" (
    "day" TIMESTAMP(3) NOT NULL,
    "estUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "GlobalSpend_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "SpendReservation" (
    "sessionId" TEXT NOT NULL,
    "reservedUsd" DECIMAL(65,30) NOT NULL,
    "settledUsd" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendReservation_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE INDEX "Scenario_company_type_targetLevel_difficulty_idx" ON "Scenario"("company", "type", "targetLevel", "difficulty");

-- CreateIndex
CREATE INDEX "Scenario_isActive_idx" ON "Scenario"("isActive");

-- CreateIndex
CREATE INDEX "PanelSeat_scenarioId_idx" ON "PanelSeat"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelSeat_scenarioId_seatOrder_key" ON "PanelSeat"("scenarioId", "seatOrder");

-- CreateIndex
CREATE INDEX "MockSession_userId_createdAt_idx" ON "MockSession"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MockSession_userId_status_idx" ON "MockSession"("userId", "status");

-- CreateIndex
CREATE INDEX "MockSession_scenarioId_idx" ON "MockSession"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "MockSession_userId_clientRequestId_key" ON "MockSession"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "MockTurn_sessionId_seq_idx" ON "MockTurn"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "MockTurn_sessionId_seq_key" ON "MockTurn"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "DimensionScore_sessionId_dimension_idx" ON "DimensionScore"("sessionId", "dimension");

-- CreateIndex
CREATE INDEX "DimensionScore_userId_key_createdAt_idx" ON "DimensionScore"("userId", "key", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PanelVerdict_sessionId_key" ON "PanelVerdict"("sessionId");

-- CreateIndex
CREATE INDEX "ConfidenceMetric_userId_measuredAt_idx" ON "ConfidenceMetric"("userId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "DrillAssignment_userId_status_idx" ON "DrillAssignment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DrillAssignment_userId_questionId_sourceSessionId_key" ON "DrillAssignment"("userId", "questionId", "sourceSessionId");

-- CreateIndex
CREATE INDEX "JudgmentJob_status_leaseUntil_idx" ON "JudgmentJob"("status", "leaseUntil");

-- AddForeignKey
ALTER TABLE "PanelSeat" ADD CONSTRAINT "PanelSeat_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockSession" ADD CONSTRAINT "MockSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockSession" ADD CONSTRAINT "MockSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockTurn" ADD CONSTRAINT "MockTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionScore" ADD CONSTRAINT "DimensionScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelVerdict" ADD CONSTRAINT "PanelVerdict_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceMetric" ADD CONSTRAINT "ConfidenceMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceMetric" ADD CONSTRAINT "ConfidenceMetric_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillAssignment" ADD CONSTRAINT "DrillAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillAssignment" ADD CONSTRAINT "DrillAssignment_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "MockSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgmentJob" ADD CONSTRAINT "JudgmentJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendReservation" ADD CONSTRAINT "SpendReservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

