-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TurnRole" AS ENUM ('USER', 'INTERVIEWER');

-- CreateEnum
CREATE TYPE "SignalLevel" AS ENUM ('NEW_GRAD', 'SDE_II', 'SENIOR');

-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('BEHAVIORAL', 'SYSTEM_DESIGN', 'CODING_VERBAL', 'HIRING_MANAGER', 'BAR_RAISER_PANEL');

-- CreateEnum
CREATE TYPE "ScenarioDifficulty" AS ENUM ('WARMUP', 'CALIBRATED', 'ADVERSARIAL');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PENDING', 'LIVE', 'DEBRIEF', 'COMPLETED', 'ABANDONED', 'FAILED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "ScoreDimension" AS ENUM ('LP', 'STAR_STRUCTURE', 'TECHNICAL_DEPTH', 'COMMUNICATION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "DrillStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('ADVANCED', 'REJECTED', 'GHOSTED', 'OFFER', 'PENDING');

-- CreateEnum
CREATE TYPE "KeySource" AS ENUM ('ALOUD', 'USER');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'INVALID', 'EXHAUSTED', 'REVOKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "targetCompanies" TEXT[] DEFAULT ARRAY['amazon']::TEXT[],
    "interviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

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
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "apiKeyId" TEXT,
    "keySource" "KeySource" NOT NULL DEFAULT 'ALOUD',
    "provider" "LlmProvider" NOT NULL DEFAULT 'OPENAI',
    "modelUsed" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PENDING',
    "targetLevel" "SignalLevel" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "activeSeatIndex" INTEGER NOT NULL DEFAULT 0,
    "degradedDelivery" BOOLEAN NOT NULL DEFAULT false,
    "overallSignal" "SignalLevel",
    "confidence" INTEGER,
    "passed" BOOLEAN,
    "reportJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seatId" TEXT,
    "role" "TurnRole" NOT NULL,
    "seq" INTEGER NOT NULL,
    "clientTurnId" TEXT,
    "transcript" TEXT,
    "metricsJson" JSONB,
    "disfluencyJson" JSONB,
    "events" JSONB,
    "transcriptionMissing" BOOLEAN NOT NULL DEFAULT false,
    "audioStartMs" INTEGER,
    "audioEndMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTurn_pkey" PRIMARY KEY ("id")
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
    "rubricVersion" TEXT NOT NULL,
    "judgeModel" TEXT NOT NULL,
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
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeProfile_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Scenario_company_type_targetLevel_difficulty_idx" ON "Scenario"("company", "type", "targetLevel", "difficulty");

-- CreateIndex
CREATE INDEX "Scenario_isActive_idx" ON "Scenario"("isActive");

-- CreateIndex
CREATE INDEX "PanelSeat_scenarioId_idx" ON "PanelSeat"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelSeat_scenarioId_seatOrder_key" ON "PanelSeat"("scenarioId", "seatOrder");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "InterviewSession"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InterviewSession_userId_status_idx" ON "InterviewSession"("userId", "status");

-- CreateIndex
CREATE INDEX "InterviewSession_scenarioId_idx" ON "InterviewSession"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_userId_clientRequestId_key" ON "InterviewSession"("userId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewTurn_sessionId_seq_key" ON "InterviewTurn"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewTurn_sessionId_clientTurnId_key" ON "InterviewTurn"("sessionId", "clientTurnId");

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

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelSeat" ADD CONSTRAINT "PanelSeat_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ProviderKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTurn" ADD CONSTRAINT "InterviewTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionScore" ADD CONSTRAINT "DimensionScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelVerdict" ADD CONSTRAINT "PanelVerdict_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceMetric" ADD CONSTRAINT "ConfidenceMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfidenceMetric" ADD CONSTRAINT "ConfidenceMetric_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillAssignment" ADD CONSTRAINT "DrillAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillAssignment" ADD CONSTRAINT "DrillAssignment_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgmentJob" ADD CONSTRAINT "JudgmentJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderKey" ADD CONSTRAINT "ProviderKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeProfile" ADD CONSTRAINT "ResumeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendReservation" ADD CONSTRAINT "SpendReservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
