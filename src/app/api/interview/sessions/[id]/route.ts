import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

const patchSchema = z.object({ event: z.enum(["live", "interrupt"]) });

/** PENDING→LIVE ("live") and LIVE→INTERRUPTED ("interrupt") transitions. */
export async function PATCH(
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
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const interview = await prisma.interviewSession.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!interview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (parsed.data.event === "live") {
      const r = await prisma.interviewSession.updateMany({
        where: { id, userId, status: "PENDING" },
        data: { status: "LIVE", startedAt: new Date() },
      });
      return NextResponse.json({ status: r.count > 0 ? "LIVE" : interview.status });
    }
    const r = await prisma.interviewSession.updateMany({
      where: { id, userId, status: "LIVE" },
      data: { status: "INTERRUPTED" },
    });
    return NextResponse.json({ status: r.count > 0 ? "INTERRUPTED" : interview.status });
  } catch (err) {
    log.error("[PATCH /api/interview/sessions/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Rehydrate live orchestration state after a refresh (status + resume cursor). */
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
    const interview = await prisma.interviewSession.findFirst({
      where: { id, userId },
      select: {
        status: true,
        scenarioId: true,
        keySource: true,
        // D5: the seat cursor + roster so a refresh reconnects onto the right
        // interviewer with the right isLast math (not silently back to seat 0).
        activeSeatIndex: true,
        scenario: {
          select: {
            panelSeats: {
              orderBy: { seatOrder: "asc" },
              select: {
                id: true,
                personaName: true,
                ownedLPs: true,
                isBarRaiser: true,
                voice: true,
              },
            },
          },
        },
      },
    });
    if (!interview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const agg = await prisma.interviewTurn.aggregate({
      where: { sessionId: id },
      _max: { seq: true },
    });
    return NextResponse.json({
      status: interview.status,
      scenarioId: interview.scenarioId,
      maxSeq: agg._max.seq ?? -1,
      activeSeatIndex: interview.activeSeatIndex,
      keySource: interview.keySource,
      maxDurationSec: env.MAX_SESSION_SEC,
      seats: interview.scenario.panelSeats.map((s) => ({
        id: s.id,
        personaName: s.personaName,
        ownedLPs: s.ownedLPs,
        isBarRaiser: s.isBarRaiser,
        voice: s.voice,
      })),
    });
  } catch (err) {
    log.error("[GET /api/interview/sessions/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
