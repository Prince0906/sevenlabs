import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { mintRealtimeEphemeral, ProviderError } from "@/lib/coach/openai";
import {
  checkRateLimit,
  reserveGlobalSpend,
  createReservation,
  estimateSessionUsd,
  settleReservation,
} from "@/lib/mock/spend";

const bodySchema = z.object({
  scenarioId: z.string().min(1),
  clientRequestId: z.string().min(1),
});

const MINT_RATE_LIMIT = 10;
const RATE_WINDOW_SEC = 60;
const LIVE_CAP = 1;

function safetyId(userId: string): string {
  return createHash("sha256")
    .update(`${userId}:${env.AUTH_SECRET}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // CSRF: same-origin only for this credential-minting endpoint.
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { scenarioId, clientRequestId } = parsed.data;

    // Idempotency: a repeated clientRequestId never double-mints.
    const existing = await prisma.mockSession.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Duplicate request", sessionId: existing.id },
        { status: 409 }
      );
    }

    // L1/L2 rate limits (per-IP + per-user).
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [okUser, okIp] = await Promise.all([
      checkRateLimit(`mint:user:${userId}`, MINT_RATE_LIMIT, RATE_WINDOW_SEC),
      checkRateLimit(`mint:ip:${ip}`, MINT_RATE_LIMIT, RATE_WINDOW_SEC),
    ]);
    if (!okUser || !okIp) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    // Single-LIVE-session concurrency cap.
    const liveCount = await prisma.mockSession.count({
      where: { userId, status: "LIVE" },
    });
    if (liveCount >= LIVE_CAP) {
      return NextResponse.json(
        { error: "A session is already live" },
        { status: 409 }
      );
    }

    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: { panelSeats: { orderBy: { seatOrder: "asc" } } },
    });
    if (!scenario || !scenario.isActive || scenario.panelSeats.length === 0) {
      return NextResponse.json({ error: "Scenario unavailable" }, { status: 404 });
    }

    // L4 global daily kill-switch (atomic add-if-under-cap soft hold).
    const estimatedUsd = estimateSessionUsd();
    if (!(await reserveGlobalSpend(estimatedUsd))) {
      return NextResponse.json(
        { error: "At capacity, try again shortly" },
        { status: 503 }
      );
    }

    const created = await prisma.mockSession.create({
      data: {
        userId,
        scenarioId,
        clientRequestId,
        provider: "OPENAI",
        modelUsed: env.OPENAI_REALTIME_MODEL,
        judgeModel: "gpt-4o-mini",
        targetLevel: scenario.targetLevel,
        status: "PENDING",
      },
    });
    await createReservation(created.id, estimatedUsd);

    // Mint the config-locked ephemeral (lead seat persona). Audio is browser↔provider.
    const lead = scenario.panelSeats[0]!;
    try {
      const ephemeral = await mintRealtimeEphemeral({
        instructions: lead.systemPrompt,
        voice: lead.voice,
        safetyIdentifier: safetyId(userId),
      });
      return NextResponse.json({
        sessionId: created.id,
        seats: scenario.panelSeats.map((s) => ({
          id: s.id,
          personaName: s.personaName,
          ownedLPs: s.ownedLPs,
          isBarRaiser: s.isBarRaiser,
          voice: s.voice,
        })),
        ephemeral,
        spend: {
          sessionCeilingUsd: env.SESSION_CEILING_USD,
          maxDurationSec: env.MAX_SESSION_SEC,
          estimatedUsd,
        },
      });
    } catch (e) {
      await prisma.mockSession.update({
        where: { id: created.id },
        data: { status: "FAILED" },
      });
      await settleReservation(created.id, 0);
      log.error("mint failed at create", {
        sessionId: created.id,
        status: e instanceof ProviderError ? e.status : 0,
      });
      return NextResponse.json({ error: "Voice unavailable" }, { status: 502 });
    }
  } catch (err) {
    log.error("[POST /api/mock/sessions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
