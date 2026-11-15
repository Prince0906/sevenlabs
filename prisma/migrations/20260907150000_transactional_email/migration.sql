CREATE TABLE "EmailRecipient" (
  "hash" TEXT NOT NULL,
  "suppressedAt" TIMESTAMP(3),
  "suppressionReason" TEXT,
  "lastRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00'::timestamp without time zone,
  CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("hash")
);
CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "recipientHash" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "eventRank" INTEGER NOT NULL DEFAULT 0,
  "eventAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailDelivery_recipientHash_idx" ON "EmailDelivery"("recipientHash");
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_recipientHash_fkey" FOREIGN KEY ("recipientHash") REFERENCES "EmailRecipient"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;
