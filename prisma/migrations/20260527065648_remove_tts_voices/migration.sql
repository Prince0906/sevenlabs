/*
  Warnings:

  - You are about to drop the `Generation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Voice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Generation" DROP CONSTRAINT "Generation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Generation" DROP CONSTRAINT "Generation_voiceId_fkey";

-- DropForeignKey
ALTER TABLE "Voice" DROP CONSTRAINT "Voice_userId_fkey";

-- DropTable
DROP TABLE "Generation";

-- DropTable
DROP TABLE "Voice";

-- DropEnum
DROP TYPE "VoiceCategory";

-- DropEnum
DROP TYPE "VoiceVariant";
