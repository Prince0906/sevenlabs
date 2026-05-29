-- AlterTable
ALTER TABLE "User" ADD COLUMN     "interviewDate" TIMESTAMP(3),
ADD COLUMN     "targetCompanies" TEXT[] DEFAULT ARRAY['amazon']::TEXT[];

-- AlterTable
ALTER TABLE "PracticeTurn" ADD COLUMN     "rubricScoresJson" JSONB;
