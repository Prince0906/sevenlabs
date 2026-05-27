-- ============================================================
-- Auth.js (NextAuth v5) — Prisma adapter tables + passwordHash
-- ============================================================

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

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

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- ============================================================
-- Voice: drop orgId, add userId + previewText + chatterboxVoiceId
-- (previewText / chatterboxVoiceId existed in schema.prisma but were
--  never migrated; folding them in here.)
-- ============================================================

DROP INDEX "Voice_orgId_idx";
ALTER TABLE "Voice" DROP COLUMN "orgId";

ALTER TABLE "Voice" ADD COLUMN "userId" TEXT;
ALTER TABLE "Voice" ADD COLUMN "previewText" TEXT;
ALTER TABLE "Voice" ADD COLUMN "chatterboxVoiceId" TEXT;

CREATE INDEX "Voice_userId_idx" ON "Voice"("userId");

ALTER TABLE "Voice" ADD CONSTRAINT "Voice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Generation: drop orgId, add userId (NOT NULL — empty table assumed)
-- + language + durationMs (also never migrated)
-- ============================================================

DROP INDEX "Generation_orgId_idx";
ALTER TABLE "Generation" DROP COLUMN "orgId";

ALTER TABLE "Generation" ADD COLUMN "userId" TEXT NOT NULL;
ALTER TABLE "Generation" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "Generation" ADD COLUMN "durationMs" INTEGER;

CREATE INDEX "Generation_userId_idx" ON "Generation"("userId");

ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Speaking Coach — PracticeSession + PracticeTurn (no orgId)
-- (Folded in from the previous WIP practice_sessions migration,
--  with orgId removed and FK to User added.)
-- ============================================================

CREATE TYPE "PracticeSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED');
CREATE TYPE "PracticeTurnRole" AS ENUM ('USER', 'COACH');

CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'delivery',
    "status" "PracticeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeSession_userId_idx" ON "PracticeSession"("userId");
CREATE INDEX "PracticeSession_userId_status_idx" ON "PracticeSession"("userId", "status");

ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PracticeTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "PracticeTurnRole" NOT NULL,
    "clientTurnId" TEXT,
    "transcript" TEXT,
    "metricsJson" JSONB,
    "audioKey" TEXT,
    "coachText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeTurn_sessionId_idx" ON "PracticeTurn"("sessionId");
CREATE UNIQUE INDEX "PracticeTurn_sessionId_clientTurnId_key" ON "PracticeTurn"("sessionId", "clientTurnId");

ALTER TABLE "PracticeTurn" ADD CONSTRAINT "PracticeTurn_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
