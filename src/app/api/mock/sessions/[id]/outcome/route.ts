import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { outcomeRequestSchema } from "@sevenlabs/shared-types";

/**
 * A1 — Real-Outcome Capture (the keystone).
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
        verdict: { select: { overallSignal: true, rubricVersion: true } },
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
    // Pin the prediction to the rubric that produced it, so calibration cohorts
    // survive a later RUBRIC_VERSION bump (D4). Snapshotted once, at first capture.
    const rubricVersion = mock.verdict?.rubricVersion ?? null;

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
        rubricVersion,
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

    // The capture card needs the company name (for the prompt copy) whether or not
    // an outcome exists yet, so fetch the session alongside the outcome. (D13)
    const [mock, outcome] = await Promise.all([
      prisma.mockSession.findFirst({
        where: { id, userId },
        select: { scenario: { select: { company: true } } },
      }),
      prisma.outcome.findFirst({
        where: { sessionId: id, userId },
        select: {
          sessionId: true,
          result: true,
          predictedSignal: true,
          predictedWeakest: true,
          capturedAt: true,
        },
      }),
    ]);
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      company: mock.scenario.company,
      outcome: outcome
        ? {
            sessionId: outcome.sessionId,
            result: outcome.result,
            predictedSignal: outcome.predictedSignal,
            predictedWeakest: outcome.predictedWeakest,
            capturedAt: outcome.capturedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    log.error("[GET /api/mock/sessions/:id/outcome]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
