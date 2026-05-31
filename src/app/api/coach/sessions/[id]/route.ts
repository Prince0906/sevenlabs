import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSessionDetail } from "@/lib/coach/turn-orchestrator";
import { getSignedUrl } from "@/lib/s3";
import { log } from "@/lib/log";

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
    const detail = await getSessionDetail(userId, id);

    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const turns = await Promise.all(
      detail.turns.map(async (t) => ({
        ...t,
        audioUrl: t.audioKey ? await getSignedUrl(t.audioKey) : null,
      }))
    );

    return NextResponse.json({ ...detail, turns });
  } catch (error) {
    log.error("[GET /api/coach/sessions/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
