import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

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
  const affected = await prisma.$executeRaw`
    UPDATE "GlobalSpend"
    SET "estUsd" = "estUsd" + ${holdUsd}
    WHERE "day" = ${day} AND "estUsd" + ${holdUsd} <= ${env.DAILY_CAP_USD}`;
  return affected > 0;
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
}

/** Settle at terminal status: reconcile GlobalSpend down by (reserved − settled). */
export async function settleReservation(
  sessionId: string,
  settledUsd: number
): Promise<void> {
  const r = await prisma.spendReservation.findUnique({ where: { sessionId } });
  if (!r || r.settledUsd !== null) return;
  const refund = Math.max(0, Number(r.reservedUsd) - settledUsd);
  await prisma.$transaction([
    prisma.spendReservation.update({
      where: { sessionId },
      data: { settledUsd },
    }),
    prisma.$executeRaw`
      UPDATE "GlobalSpend"
      SET "estUsd" = GREATEST("estUsd" - ${refund}, 0)
      WHERE "day" = ${utcDayStart()}`,
  ]);
}

/** Fixed-window rate limit via the durable RateBucket. Returns true if allowed. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const windowMs = windowSec * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const bucket = await prisma.rateBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  return bucket.count <= limit;
}
