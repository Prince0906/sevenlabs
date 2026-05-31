import { prisma } from "@/lib/db";
import { redact } from "@sevenlabs/coach-core";
import { runJudgment } from "./panel-orchestrator";
import { log } from "@/lib/log";

/**
 * Durable judgment queue (SYSTEM_DESIGN §14). `complete` writes a JudgmentJob in
 * the same txn as LIVE→DEBRIEF, so a crash can't strand a DEBRIEF with no job.
 * A boot sweep + interval re-claims PENDING jobs and RUNNING jobs whose lease
 * expired (a process that died mid-judgment) — `after()` alone dies on redeploy.
 */
const MAX_ATTEMPTS = 3;
const LEASE_SEC = 120;
const SWEEP_INTERVAL_MS = 60_000;
const DRAIN_CAP = 50; // safety cap per drain pass

/** Atomically claim one due job (PENDING, or RUNNING with an expired lease). */
async function claimNext(): Promise<{ sessionId: string; attempts: number } | null> {
  const rows = await prisma.$queryRaw<
    Array<{ sessionId: string; attempts: number }>
  >`
    UPDATE "JudgmentJob"
    SET status = 'RUNNING'::"JobStatus",
        "leaseUntil" = now() + make_interval(secs => ${LEASE_SEC}),
        attempts = attempts + 1
    WHERE "sessionId" = (
      SELECT "sessionId" FROM "JudgmentJob"
      WHERE status = 'PENDING'::"JobStatus"
         OR (status = 'RUNNING'::"JobStatus" AND "leaseUntil" < now())
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "sessionId", attempts`;
  return rows[0] ?? null;
}

async function processOne(): Promise<boolean> {
  const job = await claimNext();
  if (!job) return false;
  try {
    await runJudgment(job.sessionId); // sets MockSession → COMPLETED on success
    await prisma.judgmentJob.update({
      where: { sessionId: job.sessionId },
      data: { status: "DONE" },
    });
  } catch (err) {
    const lastError = redact(err instanceof Error ? err.message : String(err));
    if (job.attempts >= MAX_ATTEMPTS) {
      await prisma.$transaction([
        prisma.judgmentJob.update({
          where: { sessionId: job.sessionId },
          data: { status: "FAILED", lastError },
        }),
        prisma.mockSession.update({
          where: { id: job.sessionId },
          data: { status: "FAILED" },
        }),
      ]);
      log.error("judgment job exhausted", { sessionId: job.sessionId });
    } else {
      await prisma.judgmentJob.update({
        where: { sessionId: job.sessionId },
        data: { status: "PENDING", lastError },
      });
      log.warn("judgment retry queued", {
        sessionId: job.sessionId,
        attempts: job.attempts,
      });
    }
  }
  return true;
}

/** Process all currently-due jobs (bounded). */
export async function drainJudgmentQueue(): Promise<void> {
  let processed = 0;
  while (processed < DRAIN_CAP && (await processOne())) processed += 1;
}

let started = false;
/** Wire from instrumentation.register() so it runs once per server process. */
export function startJudgmentSweeper(): void {
  if (started) return;
  started = true;
  void drainJudgmentQueue().catch((e) =>
    log.error("initial judgment drain failed", e)
  );
  setInterval(() => {
    void drainJudgmentQueue().catch((e) =>
      log.error("judgment sweep failed", e)
    );
  }, SWEEP_INTERVAL_MS);
}
