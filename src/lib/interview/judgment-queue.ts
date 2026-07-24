import { prisma } from "@/lib/db";
import { redact } from "@sevenlabs/panel-core";
import { runJudgment } from "./panel-orchestrator";
import { reapRateBuckets } from "./spend";
import { log } from "@/lib/log";

/**
 * Durable judgment queue. `complete` writes a JudgmentJob in
 * the same txn as LIVE→DEBRIEF, so a crash can't strand a DEBRIEF with no job.
 * A boot sweep + interval re-claims PENDING jobs and RUNNING jobs whose lease
 * expired (a process that died mid-judgment) — `after()` alone dies on redeploy.
 */
const MAX_ATTEMPTS = 3;
const LEASE_SEC = 120;
// The normal path drains on enqueue; this interval is only the crash-recovery
// and failed-retry net, so its period IS the worst-case rescue SLA for a
// stranded job. 5 min is the deliberate floor: fast enough that no one notices,
// slow enough that an idle box doesn't burn the metered DB's op quota on empty
// polls (2 ops/tick × 1440/day dominated the free tier at 60s — see cost notes).
const SWEEP_INTERVAL_MS = 300_000;
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
    await runJudgment(job.sessionId); // sets InterviewSession → COMPLETED on success
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
        prisma.interviewSession.update({
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
    // Piggyback the rate-bucket reap on the same maintenance tick (C3).
    void reapRateBuckets().catch((e) => log.error("rate-bucket reap failed", e));
  }, SWEEP_INTERVAL_MS);
}
