import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { analyzeSpeech, analyzeDisfluency } from "@sevenlabs/panel-core";
import { transcribeAudio, ProviderError } from "@/lib/providers/openai";
import { isDeepgramConfigured, transcribeVerbatim } from "@/lib/providers/deepgram";

// Whisper's hard upload ceiling. A push-to-talk answer is opus/webm at a few
// hundred KB/min, so this is only a guard against a pathological upload.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Map a MediaRecorder mime to the extension Whisper infers the codec from. */
export function audioExt(mime: string): string {
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
 * timings), run the existing panel-core analyzer, and attach the metrics to the
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

    const interview = await prisma.interviewSession.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!interview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (interview.status !== "LIVE") {
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

    // Prefer Deepgram (VERBATIM) so disfluency is measurable — Whisper cleans
    // speech (drops ~87% of fillers, de-dupes repeats), so it can only ever read
    // as fluent. Whisper stays as the fallback when Deepgram isn't configured or
    // errors; in that case disfluency is null (pause math still works).
    let words: { word: string; start: number; end: number }[] = [];
    let durationSec = 0;
    let disfluency: ReturnType<typeof analyzeDisfluency> | null = null;

    if (isDeepgramConfigured()) {
      try {
        const r = await transcribeVerbatim(buffer, mimeType);
        disfluency = analyzeDisfluency(r.words);
        durationSec = r.durationSec;
        words = r.words.map((d) => ({ word: d.text, start: d.start, end: d.end }));
      } catch (e) {
        log.warn("verbatim transcription failed; falling back to whisper", {
          sessionId: id,
          status: e instanceof ProviderError ? e.status : 0,
        });
      }
    }

    if (words.length === 0) {
      try {
        const r = await transcribeAudio(buffer, mimeType, `answer.${audioExt(mimeType)}`);
        words = r.words;
        durationSec = r.durationSec;
      } catch (e) {
        // Best-effort: a transcription failure must not break the interview. Drop
        // this answer's fluency rather than surfacing an error to the live client.
        log.warn("turn audio transcription failed", {
          sessionId: id,
          status: e instanceof ProviderError ? e.status : 0,
        });
        return NextResponse.json({ ok: false, reason: "transcription_failed" });
      }
    }

    const metrics = analyzeSpeech({ words, turnDurationSec: durationSec });

    // Attach to the matching USER turn on the now-UNIQUE (sessionId, clientTurnId)
    // join key — one row, not a fan-out updateMany. P2025 (no such row) means the
    // text turn hasn't been written yet (the upload raced ahead); the client
    // retries on 202. (clientTurnId is only ever set on USER turns.)
    try {
      await prisma.interviewTurn.update({
        where: { sessionId_clientTurnId: { sessionId: id, clientTurnId } },
        data: {
          metricsJson: metrics,
          disfluencyJson: disfluency
            ? (disfluency as unknown as Prisma.InputJsonValue)
            : undefined,
          transcriptionMissing: words.length < 2,
        },
      });
    } catch (e) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "P2025") {
        return NextResponse.json({ pending: true }, { status: 202 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[POST /api/interview/sessions/:id/turns/audio]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
