import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { analyzeSpeech } from "@sevenlabs/coach-core";
import { transcribeAudio, ProviderError } from "@/lib/coach/openai";

// Whisper's hard upload ceiling. A push-to-talk answer is opus/webm at a few
// hundred KB/min, so this is only a guard against a pathological upload.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Map a MediaRecorder mime to the extension Whisper infers the codec from. */
function audioExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "mp4";
  return "webm";
}

/**
 * Best-effort fluency analysis for ONE push-to-talk answer (SECOND LIVE TEST,
 * 2026-06-02). The realtime transcript path (gpt-4o-transcribe) strips fillers
 * and has no word timings, so it cannot drive delivery scoring. Here the browser
 * uploads the answer's audio; we transcribe it with Whisper (verbose_json, word
 * timings), run the existing coach-core analyzer, and attach the metrics to the
 * matching USER turn — joined on the client-generated clientTurnId, since the
 * turn's seq is assigned asynchronously at the queue's dequeue.
 *
 * The audio is NOT persisted: it is transcribed in-memory and discarded, so the
 * only thing retained is the derived delivery metrics (and the transcript we
 * already store from the live session). 202 means the text turn row hasn't been
 * written yet (the upload raced ahead) — the client retries.
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

    const mock = await prisma.mockSession.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!mock) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (mock.status !== "LIVE") {
      return NextResponse.json({ error: "Session not live" }, { status: 409 });
    }

    const form = await request.formData().catch(() => null);
    const clientTurnId = form?.get("clientTurnId");
    const file = form?.get("audio");
    if (typeof clientTurnId !== "string" || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Bad audio size" }, { status: 400 });
    }

    const mimeType = file.type || "audio/webm";
    const buffer = Buffer.from(await file.arrayBuffer());

    let words: Awaited<ReturnType<typeof transcribeAudio>>["words"] = [];
    let durationSec = 0;
    try {
      const r = await transcribeAudio(buffer, mimeType, `answer.${audioExt(mimeType)}`);
      words = r.words;
      durationSec = r.durationSec;
    } catch (e) {
      // Best-effort: a Whisper failure must not break the interview. Drop this
      // answer's fluency rather than surfacing an error to the live client.
      log.warn("turn audio transcription failed", {
        sessionId: id,
        status: e instanceof ProviderError ? e.status : 0,
      });
      return NextResponse.json({ ok: false, reason: "transcription_failed" });
    }

    const metrics = analyzeSpeech({ words, turnDurationSec: durationSec });

    // Attach to the matching USER turn. updateMany (not update) because the join
    // key is clientTurnId, not the unique seq. count 0 → the text turn row hasn't
    // been written yet; tell the client to retry.
    const res = await prisma.mockTurn.updateMany({
      where: { sessionId: id, clientTurnId, role: "USER" },
      data: { metricsJson: metrics, transcriptionMissing: words.length < 2 },
    });
    if (res.count === 0) {
      return NextResponse.json({ pending: true }, { status: 202 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[POST /api/mock/sessions/:id/turns/audio]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
