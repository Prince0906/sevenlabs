import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { mintRealtimeEphemeral, ProviderError } from "@/lib/coach/openai";
import {
  buildInterviewerInstructions,
  pickSeatOpener,
  openerInstruction,
  buildPanelContextDigest,
} from "@sevenlabs/coach-core";
import { spendCentsForElapsed, isSessionOver } from "@/lib/mock/spend";
import { getResumeDigest } from "@/lib/mock/resume-digest";
import { resolveSessionKey } from "@/lib/byok";

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
        keySource: true,
        scenario: {
          select: { company: true, panelSeats: { orderBy: { seatOrder: "asc" } } },
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

    // BYOK: re-mint on the same key plane the session was created with. If the
    // user removed their key mid-session, end gracefully (the off-band judge runs
    // on Aloud's key, so the report is never hostage) rather than silently
    // shifting the realtime cost to the house. (§3.5/§3.6)
    let sessionApiKey: string | undefined = undefined;
    if (mock.keySource === "USER") {
      const resolved = await resolveSessionKey(userId);
      if (resolved.keySource !== "USER") {
        return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
      }
      sessionApiKey = resolved.apiKey;
    }

    // Per-session guard on the server clock — never re-mint past it. BYOK sessions
    // have no dollar ceiling (the user's key pays); only the MAX_SESSION_SEC hard
    // stop applies. House sessions keep the full spend + time ceiling.
    if (mock.startedAt) {
      const elapsedSec = (Date.now() - mock.startedAt.getTime()) / 1000;
      const spendCents = spendCentsForElapsed(elapsedSec);
      await prisma.mockSession.update({ where: { id }, data: { spendCents } });
      if (isSessionOver(mock.keySource, spendCents, elapsedSec)) {
        return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
      }
    }

    const seat = mock.scenario.panelSeats[seatIndex];
    if (!seat) {
      return NextResponse.json({ error: "Scenario unavailable" }, { status: 404 });
    }
    // Variety: steer this seat to OPEN on a per-session sub-topic so the
    // interview differs each run (deterministic on (sessionId, seatOrder) → stable
    // across this seat's re-mints; the Bar Raiser has no opener — it adapts).
    const opener = pickSeatOpener(mock.scenario.company, seat.seatOrder, id);
    let persona = opener
      ? `${seat.systemPrompt}\n\n${openerInstruction(opener)}`
      : seat.systemPrompt;
    if (reason === "resume_interrupted") {
      persona = `${persona}\n\nThe session was briefly interrupted and is resuming. Pick up naturally from where the conversation left off.`;
    }
    // Ground every seat (incl. handoff seats and seat-0 re-mints) in the
    // candidate's resume — per-user, so injected here at mint. INTERVIEW_ENGINE_PLAN §14.1.
    const resumeDigest = await getResumeDigest(userId);
    if (resumeDigest) {
      persona = `${persona}\n\n${resumeDigest}`;
    }

    // Cross-segment continuity (§14.2): a handoff seat is a brand-new realtime
    // session with no memory of prior interviewers. Inject a BOUNDED digest of the
    // recent committed turns so the incoming interviewer remembers the arc instead
    // of restarting the interview. Only on handoff — a same-seat re-mint resumes
    // via the client's (bounded) history replay.
    if (reason === "seat_handoff") {
      const recent = await prisma.mockTurn.findMany({
        where: { sessionId: id },
        orderBy: { seq: "desc" },
        take: 10,
        select: { role: true, transcript: true },
      });
      const context = buildPanelContextDigest(
        recent.reverse().map((t) => ({ role: t.role, text: t.transcript }))
      );
      if (context) {
        persona = `${persona}\n\n${context}`;
      }
    }
    // The persona (a thin, leakable voice prompt) wrapped with the fixed
    // interviewer frame contract in the SYSTEM instructions — the primary
    // adversarial defense (held against role-flip / "tell me the answer" / etc.).
    const instructions = buildInterviewerInstructions(persona);

    try {
      const ephemeral = await mintRealtimeEphemeral({
        instructions,
        voice: seat.voice,
        safetyIdentifier: safetyId(userId),
        apiKey: sessionApiKey,
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
