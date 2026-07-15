import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { analyzeSpeech } from "@sevenlabs/panel-core";
import {
  wordTimestampSchema,
  turnEventsSchema,
  type SpeechMetrics,
} from "@sevenlabs/shared-types";
import { spendCentsForElapsed, isSessionOver } from "@/lib/interview/spend";

const bodySchema = z.object({
  seq: z.number().int().nonnegative(),
  role: z.enum(["USER", "INTERVIEWER"]),
  seatId: z.string().nullish(),
  transcript: z.string().optional(),
  words: z.array(wordTimestampSchema).optional(),
  events: turnEventsSchema.optional(),
  // Stable join key for the parallel fluency-audio upload (USER turns).
  clientTurnId: z.string().optional(),
});

/** Idempotent turn checkpoint. Server recomputes USER metrics from the word-span
 * (never wall-clock) and reconciles spend on the server clock. */
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
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const b = parsed.data;

    const interview = await prisma.interviewSession.findFirst({
      where: { id, userId },
      select: { status: true, startedAt: true, keySource: true },
    });
    if (!interview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (interview.status !== "LIVE") {
      return NextResponse.json({ error: "Session not live" }, { status: 409 });
    }

    // USER metrics from the speech word-span; missing timings → excluded from CI.
    let metrics: SpeechMetrics | null = null;
    let transcriptionMissing = false;
    if (b.role === "USER") {
      const words = b.words ?? [];
      if (words.length >= 2 && b.transcript) {
        const turnDurationSec = Math.max(
          words[words.length - 1]!.end - words[0]!.start,
          0.001
        );
        metrics = analyzeSpeech({ words, turnDurationSec });
      } else {
        transcriptionMissing = true;
      }
    }

    // Idempotency on (sessionId, seq): identical replay → duplicate; different → 409.
    const existing = await prisma.interviewTurn.findUnique({
      where: { sessionId_seq: { sessionId: id, seq: b.seq } },
    });
    if (existing) {
      if ((existing.transcript ?? "") === (b.transcript ?? "")) {
        return NextResponse.json({
          turnId: existing.id,
          seq: b.seq,
          duplicate: true,
          metrics: existing.metricsJson,
        });
      }
      return NextResponse.json({ error: "SEQ_CONFLICT" }, { status: 409 });
    }

    const turn = await prisma.interviewTurn.create({
      data: {
        sessionId: id,
        seq: b.seq,
        role: b.role,
        seatId: b.seatId ?? null,
        clientTurnId: b.clientTurnId ?? null,
        transcript: b.transcript ?? null,
        metricsJson: metrics ?? undefined,
        events: b.events ?? undefined,
        transcriptionMissing,
      },
    });

    let sessionExpired = false;
    if (interview.startedAt) {
      const elapsedSec = (Date.now() - interview.startedAt.getTime()) / 1000;
      const spendCents = spendCentsForElapsed(elapsedSec);
      await prisma.interviewSession.update({ where: { id }, data: { spendCents } });
      sessionExpired = isSessionOver(interview.keySource, spendCents, elapsedSec);
    }

    return NextResponse.json({
      turnId: turn.id,
      seq: b.seq,
      duplicate: false,
      metrics,
      sessionExpired,
    });
  } catch (err) {
    log.error("[POST /api/interview/sessions/:id/turns]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
