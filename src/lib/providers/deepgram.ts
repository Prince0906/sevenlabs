import type { DisfluencyWord } from "@sevenlabs/panel-core";
import { env } from "@/lib/env";
import { ProviderError } from "@/lib/providers/openai";

const DEEPGRAM_LISTEN = "https://api.deepgram.com/v1/listen";

// Deepgram's filler_words vocabulary (canonical spellings, normalised). With
// filler_words=true these tokens appear inline in the words array; Deepgram does
// NOT tag which words are fillers, so we flag them here by membership — the
// vendor-specific knowledge that belongs in the adapter, not the engine.
const DEEPGRAM_FILLERS = new Set(["uh", "um", "mhmm", "mmmm", "uhuh", "uhhuh", "nuhuh"]);
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Whether the verbatim disfluency path is available (Deepgram key present). */
export function isDeepgramConfigured(): boolean {
  return !!env.DEEPGRAM_API_KEY;
}

/**
 * VERBATIM transcription for disfluency measurement. Unlike Whisper (which drops
 * ~87% of filled pauses and silently de-duplicates repeats), Deepgram with
 * `filler_words=true` keeps um/uh and the repeats, and returns word-level
 * timestamps the disfluency engine + pause math both consume. The returned words
 * are already in the engine's `DisfluencyWord` shape (fillers pre-flagged).
 */
export async function transcribeVerbatim(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ transcript: string; words: DisfluencyWord[]; durationSec: number }> {
  const key = env.DEEPGRAM_API_KEY;
  if (!key) throw new ProviderError("deepgram_unconfigured", 0);

  const params = new URLSearchParams({
    model: "nova-3",
    filler_words: "true",
    punctuate: "true",
    language: "en",
  });

  const res = await fetch(`${DEEPGRAM_LISTEN}?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": mimeType },
    body: new Uint8Array(audioBuffer),
  });

  if (!res.ok) {
    throw new ProviderError("deepgram_failed", res.status);
  }

  const data = (await res.json()) as {
    metadata?: { duration?: number };
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
          words?: Array<{ word: string; start: number; end: number }>;
        }>;
      }>;
    };
  };

  const alt = data.results?.channels?.[0]?.alternatives?.[0];
  const words: DisfluencyWord[] = (alt?.words ?? []).map((wd) => ({
    text: wd.word,
    start: wd.start,
    end: wd.end,
    isFiller: DEEPGRAM_FILLERS.has(norm(wd.word)),
  }));

  return {
    transcript: (alt?.transcript ?? "").trim(),
    words,
    durationSec: data.metadata?.duration ?? words.at(-1)?.end ?? 0,
  };
}
