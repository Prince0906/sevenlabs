-- Verdict provenance for calibration (D4): record the rubric content + judge
-- model that produced each verdict, and drop the never-read placeholder on
-- MockSession (provenance belongs on the verdict, not the session). The NOT NULL
-- defaults backfill rows written before provenance existed; the orchestrator
-- stamps both columns explicitly going forward.

-- AlterTable
ALTER TABLE "MockSession" DROP COLUMN "judgeModel";

-- AlterTable
ALTER TABLE "PanelVerdict" ADD COLUMN     "judgeModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
ADD COLUMN     "rubricVersion" TEXT NOT NULL DEFAULT '2026.06.0';
