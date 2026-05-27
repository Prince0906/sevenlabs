import { createSessionRequestSchema } from "@sevenlabs/shared-types";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPracticeSession } from "@/lib/coach/turn-orchestrator";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await createPracticeSession(userId, parsed.data.mode);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/coach/session]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
