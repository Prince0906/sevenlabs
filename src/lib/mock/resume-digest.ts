import { prisma } from "@/lib/db";
import { buildResumeDigest } from "@sevenlabs/coach-core";
import { resumeFactsSchema } from "@sevenlabs/shared-types";
import { log } from "@/lib/log";

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
  // D11 / OWASP-LLM01: factsJson is candidate-influenced data about to enter a
  // live interviewer prompt. Parse it at this read boundary instead of trusting
  // the column — on ANY shape mismatch fail CLOSED (no grounding) rather than
  // inject an unvalidated blob. validateResumeFacts guards the write path; this
  // guards a manual DB edit or a future validator regression.
  const parsed = resumeFactsSchema.safeParse(profile.factsJson);
  if (!parsed.success) {
    log.warn("resume factsJson failed schema validation — skipping grounding", {
      userId,
    });
    return "";
  }
  return buildResumeDigest(parsed.data);
}
