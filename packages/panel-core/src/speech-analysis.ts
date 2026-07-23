import type { SpeechMetrics, WordTimestamp } from "@sevenlabs/shared-types";

// Single-token disfluencies Whisper actually emits. Elongated hesitations
// ("ufff", "ahhh", "ummm") get transcribed with varying repeat counts, so the
// common spellings are listed explicitly. The multi-word phrases below are
// matched per-token elsewhere, so they only catch their first token today —
// kept for documentation, not relied on.
const FILLER_WORDS = new Set([
  "um",
  "umm",
  "uh",
  "uhh",
  "er",
  "erm",
  "ah",
  "uff",
  "hmm",
  "like",
  "you know",
  "sort of",
  "kind of",
]);

const PAUSE_THRESHOLD_SEC = 0.4;

export interface AnalyzeSpeechInput {
  words: WordTimestamp[];
  turnDurationSec: number;
}

/**
 * Compute delivery metrics from Whisper word timestamps.
 */
export function analyzeSpeech(input: AnalyzeSpeechInput): SpeechMetrics {
  const { words, turnDurationSec } = input;

  if (words.length === 0 || turnDurationSec <= 0) {
    return {
      wpm: 0,
      pauseCount: 0,
      avgPauseMs: 0,
      longestPauseMs: 0,
      fillerCount: 0,
      speakingRatio: 0,
      turnDurationSec,
    };
  }

  const speakingDurationSec = Math.max(
    words[words.length - 1]!.end - words[0]!.start,
    0.001
  );
  const wordCount = words.length;
  // Use actual audio duration for WPM — Whisper word timestamps can be
  // compressed, inflating WPM when VAD clips speech tightly.
  const wpm = Math.round((wordCount / turnDurationSec) * 60);

  const pausesMs: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const gapSec = words[i]!.start - words[i - 1]!.end;
    if (gapSec >= PAUSE_THRESHOLD_SEC) {
      pausesMs.push(gapSec * 1000);
    }
  }

  const pauseCount = pausesMs.length;
  const avgPauseMs =
    pauseCount > 0
      ? Math.round(pausesMs.reduce((a, b) => a + b, 0) / pauseCount)
      : 0;
  const longestPauseMs =
    pauseCount > 0 ? Math.round(Math.max(...pausesMs)) : 0;

  const fillerCount = words.filter((w) =>
    FILLER_WORDS.has(w.word.toLowerCase().replace(/[.,!?]/g, ""))
  ).length;

  const speakingRatio = Math.min(
    1,
    Math.max(0, speakingDurationSec / turnDurationSec)
  );

  return {
    wpm,
    pauseCount,
    avgPauseMs,
    longestPauseMs,
    fillerCount,
    speakingRatio: Math.round(speakingRatio * 100) / 100,
    turnDurationSec: Math.round(turnDurationSec * 10) / 10,
  };
}
