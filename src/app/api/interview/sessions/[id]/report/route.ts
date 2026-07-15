import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

const JUDGMENT_DEADLINE_SEC = 180;

/** Poll: 202 while DEBRIEF (within deadline), 200 report when COMPLETED (ETag/304),
 * 200 FAILED past the deadline so the browser stops spinning. */
export async function GET(
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
    const interview = await prisma.interviewSession.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        endedAt: true,
        reportJson: true,
      },
    });
    if (!interview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (interview.status === "COMPLETED") {
      const etag = `"${interview.id}-COMPLETED"`;
      if (request.headers.get("if-none-match") === etag) {
        return new NextResponse(null, { status: 304 });
      }
      return NextResponse.json(
        { status: "COMPLETED", report: interview.reportJson },
        { headers: { ETag: etag } }
      );
    }

    if (interview.status === "FAILED") {
      return NextResponse.json({ status: "FAILED" });
    }

    if (interview.status === "DEBRIEF") {
      // Hard wall-clock bound on the client's wait. A job that genuinely exhausts
      // its retries flips the SESSION to FAILED in the queue (caught above), so the
      // case this catches is a worker that died with the job stuck PENDING — without
      // it the browser would poll 202 forever. We don't persist FAILED here: a late
      // judgment can still surface a report on a later visit. (A5)
      const ageSec = interview.endedAt
        ? (Date.now() - interview.endedAt.getTime()) / 1000
        : 0;
      if (ageSec > JUDGMENT_DEADLINE_SEC) {
        return NextResponse.json({ status: "FAILED", reason: "judgment_timeout" });
      }
      return NextResponse.json(
        { status: "DEBRIEF", pollAfterMs: 2000 },
        { status: 202 }
      );
    }

    return NextResponse.json({ status: interview.status });
  } catch (err) {
    log.error("[GET /api/interview/sessions/:id/report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
