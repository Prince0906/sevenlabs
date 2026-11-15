-- Expand only. Keep User IDs, legacy hashes/timestamps and OAuth identities.
-- Apply at the approved auth cutover with legacy auth writes paused. If legacy
-- remains writable afterward, rerun the reviewed backfill before switching.
ALTER TABLE "User"
  ADD COLUMN "authEmailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disabledAt" TIMESTAMP(3);

ALTER TABLE "Account"
  ALTER COLUMN "type" SET DEFAULT 'oauth',
  ADD COLUMN "password" TEXT,
  ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Session"
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AuthVerification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthVerification_identifier_idx" ON "AuthVerification"("identifier");

CREATE TABLE "AuthRateLimit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthRateLimit_key_key" ON "AuthRateLimit"("key");

UPDATE "User" SET "authEmailVerified" = ("emailVerified" IS NOT NULL);
UPDATE "Account" SET "accessTokenExpiresAt" = to_timestamp("expires_at")
  WHERE "expires_at" IS NOT NULL;
INSERT INTO "Account" ("id", "userId", "type", "provider", "providerAccountId", "password")
  SELECT 'credential:' || "id", "id", 'credential', 'credential', "id", "passwordHash"
  FROM "User" WHERE "passwordHash" IS NOT NULL
  ON CONFLICT ("provider", "providerAccountId") DO NOTHING;
