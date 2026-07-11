-- Remove the legacy synchronous speaking coach. Its routes, API, feature code,
-- and dashboard aggregates are deleted; the dashboard now reads panel data only.
-- The PracticeTurnRole enum is kept — MockTurn.role reuses it (role=COACH means
-- "interviewer seat"), so only PracticeSessionStatus is dropped here.

-- DropForeignKey
ALTER TABLE "PracticeSession" DROP CONSTRAINT "PracticeSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "PracticeTurn" DROP CONSTRAINT "PracticeTurn_sessionId_fkey";

-- DropTable
DROP TABLE "PracticeSession";

-- DropTable
DROP TABLE "PracticeTurn";

-- DropEnum
DROP TYPE "PracticeSessionStatus";
