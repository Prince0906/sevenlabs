import { turnCompleteRequestSchema } from "@sevenlabs/shared-types";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processTurn } from "@/lib/coach/turn-orchestrator";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const clientTurnId = formData.get("clientTurnId");
    const audio = formData.get("audio");

    const parsed = turnCompleteRequestSchema.safeParse({
      sessionId,
      clientTurnId,
    });
    if (!parsed.success || !(audio instanceof Blob)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const mimeType = audio.type || "audio/webm";
    const buffer = Buffer.from(await audio.arrayBuffer());

    const result = await processTurn({
      userId,
      sessionId: parsed.data.sessionId,
      clientTurnId: parsed.data.clientTurnId,
      audioBuffer: buffer,
      mimeType,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    console.error("[POST /api/coach/turn]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
