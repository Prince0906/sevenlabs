import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { outcomeRequestSchema } from "@sevenlabs/shared-types";

/**
 * A1 — Real-Outcome Capture (ROADMAP Inc 1, the keystone).
 *
 * Records the real-world result of the interview this mock prepared for, bound to
 * the session's prior prediction. The (prediction → outcome) pair is the one
 * calibration label a foundation model cannot manufacture. predicted* are
 * snapshotted once, at first capture, so the labeled row survives rubric/model
 * churn. One outcome per session (Outcome.sessionId is @unique); re-POSTing
 * corrects the result without re-snapshotting the prediction.
 */
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
    const parsed = outcomeRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const b = parsed.data;

    // userId-scoped; snapshot the prediction (verdict signal + weakest dimension).
    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: {
        id: true,
        verdict: { select: { overallSignal: true } },
        dimensionScores: {
          orderBy: { score: "asc" },
          take: 1,
          select: { key: true },
        },
      },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const predictedSignal = mock.verdict?.overallSignal ?? null;
    const predictedWeakest = mock.dimensionScores[0]?.key ?? null;

    const outcome = await prisma.outcome.upsert({
      where: { sessionId: id },
      create: {
        userId,
        sessionId: id,
        result: b.result,
        offerLevel: b.offerLevel ?? null,
        note: b.note ?? null,
        predictedSignal,
        predictedWeakest,
      },
      // predicted* intentionally omitted — the snapshot is taken once, at first capture.
      update: {
        result: b.result,
        offerLevel: b.offerLevel ?? null,
        note: b.note ?? null,
      },
    });

    return NextResponse.json({
      sessionId: outcome.sessionId,
      result: outcome.result,
      predictedSignal: outcome.predictedSignal,
      predictedWeakest: outcome.predictedWeakest,
      capturedAt: outcome.capturedAt.toISOString(),
    });
  } catch (err) {
    log.error("[POST /api/mock/sessions/:id/outcome]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Fetch the captured outcome for a session, if any (userId-scoped). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const outcome = await prisma.outcome.findFirst({
      where: { sessionId: id, userId },
      select: {
        sessionId: true,
        result: true,
        predictedSignal: true,
        predictedWeakest: true,
        capturedAt: true,
      },
    });
    if (!outcome) {
      return NextResponse.json({ outcome: null });
    }

    return NextResponse.json({
      outcome: {
        sessionId: outcome.sessionId,
        result: outcome.result,
        predictedSignal: outcome.predictedSignal,
        predictedWeakest: outcome.predictedWeakest,
        capturedAt: outcome.capturedAt.toISOString(),
      },
    });
  } catch (err) {
    log.error("[GET /api/mock/sessions/:id/outcome]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
