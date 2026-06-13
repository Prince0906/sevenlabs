-- DropIndex
DROP INDEX "MockTurn_sessionId_clientTurnId_idx";

-- AlterTable
ALTER TABLE "MockSession" ADD COLUMN     "activeSeatIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "degradedDelivery" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "MockTurn_sessionId_clientTurnId_key" ON "MockTurn"("sessionId", "clientTurnId");

