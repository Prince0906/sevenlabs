import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isByokConfigured } from "@/lib/crypto";
import { log } from "@/lib/log";

/**
 * Readiness probe (Caddy / uptime checks hit this; it's a public route). "Ready"
 * means the box can actually reach Postgres — a DB-less box must NOT read as
 * healthy, so a failed `SELECT 1` returns 503. `byok` reports whether key custody
 * is configured (informational — the app runs on the house key without it, so it
 * does NOT gate readiness). (C2)
 */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (err) {
    log.error("[GET /api/health] database unreachable", err);
  }

  return NextResponse.json(
    {
      status: db ? "healthy" : "unavailable",
      db,
      byok: isByokConfigured(),
      timestamp: new Date().toISOString(),
    },
    { status: db ? 200 : 503 }
  );
}
