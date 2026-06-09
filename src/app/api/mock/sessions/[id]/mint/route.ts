import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { mintRealtimeEphemeral, ProviderError } from "@/lib/coach/openai";
import { buildInterviewerInstructions } from "@sevenlabs/coach-core";
import { spendCentsForElapsed, isOverCeiling } from "@/lib/mock/spend";

const bodySchema = z.object({
  // ttl_expiry / seat_handoff re-mint a LIVE session (no flip, no recharge);
  // resume_interrupted flips INTERRUPTED -> LIVE. seatIndex selects which panel
  // seat's persona+voice to mint (handoff swaps voice mid-panel).
  reason: z
    .enum(["ttl_expiry", "resume_interrupted", "seat_handoff"])
    .default("ttl_expiry"),
  seatIndex: z.number().int().nonnegative().default(0),
});

function safetyId(userId: string): string {
  return createHash("sha256")
    .update(`${userId}:${env.AUTH_SECRET}`)
    .digest("hex");
}

/** Re-mint a config-locked ephemeral for an in-flight session — to cross the
 * provider's short token TTL on a long interview, or to resume one the browser
 * marked INTERRUPTED. No new global hold and no re-charge: the original
 * reservation already covers this session's metered minutes; we only refuse if
 * it has crossed the per-session ceiling. SYSTEM_DESIGN §15. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { reason, seatIndex } = bodySchema.parse(
      await request.json().catch(() => ({}))
    );

    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: {
        status: true,
        startedAt: true,
        scenario: {
          select: { panelSeats: { orderBy: { seatOrder: "asc" } } },
        },
      },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const renewable =
      reason === "resume_interrupted"
        ? mock.status === "INTERRUPTED"
        : mock.status === "LIVE";
    if (!renewable) {
      return NextResponse.json(
        { error: "Session not renewable", status: mock.status },
        { status: 409 }
      );
    }

    // Per-session ceiling guard on the server clock — never re-mint past it.
    if (mock.startedAt) {
      const elapsedSec = (Date.now() - mock.startedAt.getTime()) / 1000;
      const spendCents = spendCentsForElapsed(elapsedSec);
      await prisma.mockSession.update({ where: { id }, data: { spendCents } });
      if (isOverCeiling(spendCents, elapsedSec)) {
        return NextResponse.json(
          { error: "SESSION_EXPIRED" },
          { status: 410 }
        );
      }
    }

    const seat = mock.scenario.panelSeats[seatIndex];
    if (!seat) {
      return NextResponse.json({ error: "Scenario unavailable" }, { status: 404 });
    }
    // The persona (a thin, leakable voice prompt) wrapped with the fixed
    // interviewer frame contract in the SYSTEM instructions — the primary
    // adversarial defense (held against role-flip / "tell me the answer" / etc.).
    const persona =
      reason === "resume_interrupted"
        ? `${seat.systemPrompt}\n\nThe session was briefly interrupted and is resuming. Pick up naturally from where the conversation left off.`
        : seat.systemPrompt;
    const instructions = buildInterviewerInstructions(persona);

    try {
      const ephemeral = await mintRealtimeEphemeral({
        instructions,
        voice: seat.voice,
        safetyIdentifier: safetyId(userId),
      });
      // Resume flips INTERRUPTED→LIVE only if it's still interrupted (CAS).
      if (reason === "resume_interrupted") {
        await prisma.mockSession.updateMany({
          where: { id, status: "INTERRUPTED" },
          data: { status: "LIVE" },
        });
      }
      return NextResponse.json({ ephemeral });
    } catch (e) {
      log.error("re-mint failed", {
        sessionId: id,
        status: e instanceof ProviderError ? e.status : 0,
      });
      return NextResponse.json({ error: "Voice unavailable" }, { status: 502 });
    }
  } catch (err) {
    log.error("[POST /api/mock/sessions/:id/mint]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
