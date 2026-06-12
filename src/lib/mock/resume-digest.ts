import { prisma } from "@/lib/db";
import { buildResumeDigest, type ResumeFacts } from "@sevenlabs/coach-core";

/**
 * Render the user's stored resume into the seat-instruction digest injected at
 * mint time (INTERVIEW_ENGINE_PLAN §14.1). Returns "" when the user has no
 * resume on file, so the mint routes can concatenate it unconditionally. Only
 * validated facts were ever persisted, so what reaches a seat is already
 * grounded — a seat can never reference a project the candidate didn't list.
 */
export async function getResumeDigest(userId: string): Promise<string> {
  const profile = await prisma.resumeProfile.findUnique({
    where: { userId },
    select: { factsJson: true },
  });
  if (!profile) return "";
  return buildResumeDigest(profile.factsJson as unknown as ResumeFacts);
}
