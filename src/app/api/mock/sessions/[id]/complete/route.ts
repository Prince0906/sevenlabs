import { NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { drainJudgmentQueue } from "@/lib/mock/judgment-queue";

const bodySchema = z.object({ reason: z.string().optional() });

/** CAS LIVE/INTERRUPTED → DEBRIEF and enqueue the JudgmentJob in ONE txn, so a
 * crash can't strand a DEBRIEF with no job. Kicks the queue post-response. §14. */
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
    // body is optional; parse defensively for the reason
    bodySchema.safeParse(await request.json().catch(() => ({})));

    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: { status: true, startedAt: true },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (mock.status === "DEBRIEF" || mock.status === "COMPLETED") {
      return NextResponse.json(
        { status: mock.status, pollAfterMs: 2000 },
        { status: 202 }
      );
    }
    if (mock.status !== "LIVE" && mock.status !== "INTERRUPTED") {
      return NextResponse.json({ error: "Not completable" }, { status: 409 });
    }

    const endedAt = new Date();
    const durationSec = mock.startedAt
      ? Math.round((endedAt.getTime() - mock.startedAt.getTime()) / 1000)
      : 0;

    const [updated] = await prisma.$transaction([
      prisma.mockSession.updateMany({
        where: { id, status: { in: ["LIVE", "INTERRUPTED"] } },
        data: { status: "DEBRIEF", endedAt, durationSec },
      }),
      prisma.judgmentJob.upsert({
        where: { sessionId: id },
        create: { sessionId: id, status: "PENDING" },
        update: {},
      }),
    ]);

    if (updated.count > 0) {
      after(() => drainJudgmentQueue());
    }
    return NextResponse.json(
      { status: "DEBRIEF", pollAfterMs: 2000 },
      { status: 202 }
    );
  } catch (err) {
    log.error("[POST /api/mock/sessions/:id/complete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
