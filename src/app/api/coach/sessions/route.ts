import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSessions } from "@/lib/coach/turn-orchestrator";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await listSessions(userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[GET /api/coach/sessions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
