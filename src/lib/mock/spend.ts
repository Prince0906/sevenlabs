import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * The ONE authoritative spend meter, keyed on SERVER wall-clock — never the
 * client-reported realtimeMsConsumed (a malicious client could report 0 to
 * defeat the ceiling). SYSTEM_DESIGN §13.
 */

function utcDayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Soft-hold estimate at first mint = full estimated panel cost, capped. */
export function estimateSessionUsd(): number {
  return Math.min(
    env.SESSION_CEILING_USD,
    (env.MAX_SESSION_SEC / 60) * env.REALTIME_USD_PER_MIN
  );
}

export function spendCentsForElapsed(elapsedSec: number): number {
  return Math.round((elapsedSec / 60) * env.REALTIME_USD_PER_MIN * 100);
}

export function isOverCeiling(spendCents: number, elapsedSec: number): boolean {
  return (
    spendCents / 100 >= env.SESSION_CEILING_USD ||
    elapsedSec >= env.MAX_SESSION_SEC
  );
}

/**
 * The ONE ceiling predicate, called by BOTH the mint and turns routes so the
 * BYOK-vs-house policy can't diverge. BYOK (USER): the user's key pays the
 * realtime minutes, so only the `MAX_SESSION_SEC` hard time-stop applies — never
 * the synthetic house $ ceiling (which exists to bound Aloud's own spend).
 * House (ALOUD): the full spend OR time ceiling.
 */
export function isSessionOver(
  keySource: "ALOUD" | "USER",
  spendCents: number,
  elapsedSec: number
): boolean {
  return keySource === "USER"
    ? elapsedSec >= env.MAX_SESSION_SEC
    : isOverCeiling(spendCents, elapsedSec);
}

/**
 * Global daily kill-switch: atomic add-if-under-cap (no TOCTOU). Returns false
 * → caller responds 503 CAPACITY. In-flight sessions are unaffected.
 */
export async function reserveGlobalSpend(holdUsd: number): Promise<boolean> {
  const day = utcDayStart();
  await prisma.globalSpend.upsert({
    where: { day },
    create: { day, estUsd: 0 },
    update: {},
  });
  // RETURNING the post-add total so the trip + the 80% approach are both alertable
  // (the cap was a silent 503 before — C1 observability).
  const rows = await prisma.$queryRaw<{ estUsd: string }[]>`
    UPDATE "GlobalSpend"
    SET "estUsd" = "estUsd" + ${holdUsd}
    WHERE "day" = ${day} AND "estUsd" + ${holdUsd} <= ${env.DAILY_CAP_USD}
    RETURNING "estUsd"`;
  if (rows.length === 0) {
    log.warn("daily spend cap reached — admission blocked", {
      day: day.toISOString(),
      holdUsd,
      capUsd: env.DAILY_CAP_USD,
    });
    return false;
  }
  const estUsd = Number(rows[0]!.estUsd);
  if (estUsd >= 0.8 * env.DAILY_CAP_USD) {
    log.warn("daily spend cap 80% reached", { estUsd, capUsd: env.DAILY_CAP_USD });
  }
  return true;
}

/** One reservation per session; re-mint (TTL/resume) never re-charges. */
export async function createReservation(
  sessionId: string,
  reservedUsd: number
): Promise<void> {
  await prisma.spendReservation.upsert({
    where: { sessionId },
    create: { sessionId, reservedUsd },
    update: {},
  });
  log.info("spend reservation created", { sessionId, reservedUsd });
}

/** Settle at terminal status: reconcile GlobalSpend down by (reserved − settled). */
export async function settleReservation(
  sessionId: string,
  settledUsd: number
): Promise<void> {
  const r = await prisma.spendReservation.findUnique({ where: { sessionId } });
  if (!r || r.settledUsd !== null) return;
  // Compute the refund (reservedUsd − settledUsd) in Postgres `numeric`, NOT by
  // round-tripping the stored Decimal through a JS float — only `settledUsd` (the
  // measured server-clock cost) crosses the boundary as a number. Same txn, so the
  // reservation settle and the GlobalSpend reconcile can't tear. (C3 money-math)
  await prisma.$transaction([
    prisma.spendReservation.update({
      where: { sessionId },
      data: { settledUsd },
    }),
    prisma.$executeRaw`
      UPDATE "GlobalSpend" g
      SET "estUsd" = GREATEST(
        g."estUsd" - GREATEST(r."reservedUsd" - ${settledUsd}::numeric, 0), 0)
      FROM "SpendReservation" r
      WHERE g."day" = ${utcDayStart()} AND r."sessionId" = ${sessionId}`,
  ]);
  log.info("spend reservation settled", {
    sessionId,
    settledUsd,
    reservedUsd: Number(r.reservedUsd),
  });
}

/** Fixed-window rate limit via the durable RateBucket. Returns true if allowed.
 *  Atomic INSERT … ON CONFLICT increment — a Prisma upsert races two concurrent
 *  first-hits on the same bucket into a unique-violation; this can't. (C3) */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const windowMs = windowSec * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateBucket"."count" + 1
    RETURNING "count"`;
  return (rows[0]?.count ?? 1) <= limit;
}

/** Reap rate-limit windows older than an hour (well past any active window) so the
 *  durable RateBucket table can't grow without bound. Called from the background
 *  sweep. (C3) */
export async function reapRateBuckets(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.rateBucket.deleteMany({ where: { windowStart: { lt: cutoff } } });
}
