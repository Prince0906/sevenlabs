import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (parsed.data.event === "live") {
      const r = await prisma.mockSession.updateMany({
        where: { id, userId, status: "PENDING" },
        data: { status: "LIVE", startedAt: new Date() },
      });
      return NextResponse.json({ status: r.count > 0 ? "LIVE" : mock.status });
    }
    const r = await prisma.mockSession.updateMany({
      where: { id, userId, status: "LIVE" },
      data: { status: "INTERRUPTED" },
    });
    return NextResponse.json({ status: r.count > 0 ? "INTERRUPTED" : mock.status });
  } catch (err) {
    log.error("[PATCH /api/mock/sessions/:id]", err);
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
    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: { status: true, scenarioId: true },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const agg = await prisma.mockTurn.aggregate({
      where: { sessionId: id },
      _max: { seq: true },
    });
    return NextResponse.json({
      status: mock.status,
      scenarioId: mock.scenarioId,
      maxSeq: agg._max.seq ?? -1,
    });
  } catch (err) {
    log.error("[GET /api/mock/sessions/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
