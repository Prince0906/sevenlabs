import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

const JUDGMENT_DEADLINE_SEC = 180;
const MAX_ATTEMPTS = 3;

/** Poll: 202 while DEBRIEF (within deadline), 200 report when COMPLETED (ETag/304),
 * 200 FAILED past the deadline so the browser stops spinning. SYSTEM_DESIGN §14. */
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
    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        endedAt: true,
        reportJson: true,
        job: { select: { status: true, attempts: true } },
      },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (mock.status === "COMPLETED") {
      const etag = `"${mock.id}-COMPLETED"`;
      if (request.headers.get("if-none-match") === etag) {
        return new NextResponse(null, { status: 304 });
      }
      return NextResponse.json(
        { status: "COMPLETED", report: mock.reportJson },
        { headers: { ETag: etag } }
      );
    }

    if (mock.status === "FAILED") {
      return NextResponse.json({ status: "FAILED" });
    }

    if (mock.status === "DEBRIEF") {
      const ageSec = mock.endedAt
        ? (Date.now() - mock.endedAt.getTime()) / 1000
        : 0;
      const exhausted =
        mock.job?.status === "FAILED" || (mock.job?.attempts ?? 0) >= MAX_ATTEMPTS;
      if (ageSec > JUDGMENT_DEADLINE_SEC && exhausted) {
        return NextResponse.json({ status: "FAILED", reason: "judgment_timeout" });
      }
      return NextResponse.json(
        { status: "DEBRIEF", pollAfterMs: 2000 },
        { status: 202 }
      );
    }

    return NextResponse.json({ status: mock.status });
  } catch (err) {
    log.error("[GET /api/mock/sessions/:id/report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
