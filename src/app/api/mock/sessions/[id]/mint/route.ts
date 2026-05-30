import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { mintRealtimeEphemeral, ProviderError } from "@/lib/coach/openai";
import { spendCentsForElapsed, isOverCeiling } from "@/lib/mock/spend";

const bodySchema = z.object({
  reason: z.enum(["ttl_expiry", "resume_interrupted"]).default("ttl_expiry"),
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
    const { reason } = bodySchema.parse(
      await request.json().catch(() => ({}))
    );

    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: {
        status: true,
        startedAt: true,
        scenario: {
          select: { panelSeats: { orderBy: { seatOrder: "asc" }, take: 1 } },
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

    const lead = mock.scenario.panelSeats[0];
    if (!lead) {
      return NextResponse.json({ error: "Scenario unavailable" }, { status: 404 });
    }
    const instructions =
      reason === "resume_interrupted"
        ? `${lead.systemPrompt}\n\nThe session was briefly interrupted and is resuming. Pick up naturally from where the conversation left off.`
        : lead.systemPrompt;

    try {
      const ephemeral = await mintRealtimeEphemeral({
        instructions,
        voice: lead.voice,
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
