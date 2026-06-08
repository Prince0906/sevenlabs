import type { WordTimestamp } from "@sevenlabs/shared-types";

/**
 * Vendor-agnostic disfluency engine.
 *
 * This measures HOW a candidate spoke — filled pauses ("um/uh"), word/phrase
 * REPETITIONS, silent GAPS, and false starts — from a verbatim, timestamped word
 * stream. It is deliberately decoupled from the ASR vendor: feed it a
 * `DisfluencyWord[]` and it doesn't care whether those came from Deepgram,
 * Rev AI, or anything else. The vendor adapter's only job is to map its response
 * into `DisfluencyWord[]`.
 *
 * CRITICAL: the input must be VERBATIM. OpenAI Whisper / gpt-4o-transcribe clean
 * speech — they drop ~87% of filled pauses and silently de-duplicate repeats — so
 * a transcript from them will read as artificially fluent. Fillers/repeats/false
 * starts require a verbatim-mode ASR (e.g. Deepgram `filler_words:true`). Only the
 * PAUSE measurement is ASR-independent (it comes from word-timing gaps).
 *
 * PRECISION NOTE: verbatim ASR modes are recall-tuned and can over-detect; treat
 * these counts as a FLOOR and validate against a labelled sample before surfacing
 * raw numbers as a score.
 */

/** The vendor-neutral input the engine speaks. Times are in SECONDS. */
export interface DisfluencyWord {
  text: string;
  start: number;
  end: number;
  /** Vendor-flagged filled pause (Deepgram filler_words / AssemblyAI disfluencies). */
  isFiller?: boolean;
  /** Vendor-flagged partial/cut-off word (a false-start fragment). */
  partial?: boolean;
}

export interface FillerStats {
  total: number;
  per100Words: number;
  /** Count by normalised filler token/phrase, e.g. { um: 4, uh: 2, "you know": 1 }. */
  byType: Record<string, number>;
}

export interface RepetitionInstance {
  /** The repeated unit as spoken, e.g. "I" or "I was". */
  phrase: string;
  /** How many consecutive times it occurred (2 = said twice). */
  count: number;
  atSec: number;
}

export interface FalseStartInstance {
  fragment: string;
  atSec: number;
}

export interface PauseInstance {
  sec: number;
  atSec: number;
}

export interface DisfluencyReport {
  wordCount: number;
  durationSec: number;
  fillers: FillerStats;
  repetitions: { total: number; instances: RepetitionInstance[] };
  falseStarts: { total: number; instances: FalseStartInstance[] };
  pauses: {
    count: number;
    longestSec: number;
    totalSilentSec: number;
    silentRatio: number;
    instances: PauseInstance[];
  };
}

export interface AnalyzeDisfluencyOptions {
  /** A gap >= this many seconds counts as a notable pause. Default 0.5s. */
  pauseThresholdSec?: number;
}

// Unambiguous single-token filled pauses. Deliberately EXCLUDES "like", "so",
// "well", "right" — they are usually content/discourse words and including them
// is the fastest way to over-count. When the ASR flags a token as a filler
// (`isFiller`), we trust that regardless of this set.
const FILLER_TOKENS = new Set([
  "um", "umm", "ummm", "uh", "uhh", "uhhh", "uhm", "er", "err", "erm",
  "ah", "ahh", "ahhh", "uff", "hmm", "hm", "mhm", "mm", "huh",
]);

// Discourse markers used as hesitation, matched as adjacent pairs.
const FILLER_PHRASES: [string, string][] = [
  ["you", "know"],
  ["i", "mean"],
  ["sort", "of"],
  ["kind", "of"],
];

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const round1 = (x: number): number => Math.round(x * 10) / 10;

function isFillerWord(w: DisfluencyWord): boolean {
  return w.isFiller === true || FILLER_TOKENS.has(norm(w.text));
}

/** Count filled pauses (single tokens + discourse-marker phrases), no double-count. */
export function countFillers(words: DisfluencyWord[]): FillerStats {
  const byType: Record<string, number> = {};
  let total = 0;
  let i = 0;
  while (i < words.length) {
    const a = norm(words[i]!.text);
    const b = i + 1 < words.length ? norm(words[i + 1]!.text) : "";
    const phrase = FILLER_PHRASES.find(([x, y]) => x === a && y === b);
    if (phrase) {
      const key = phrase.join(" ");
      byType[key] = (byType[key] ?? 0) + 1;
      total++;
      i += 2;
      continue;
    }
    if (isFillerWord(words[i]!)) {
      const key = a || "filler";
      byType[key] = (byType[key] ?? 0) + 1;
      total++;
    }
    i++;
  }
  return {
    total,
    per100Words: words.length > 0 ? round1((total / words.length) * 100) : 0,
    byType,
  };
}

/**
 * Adjacent n-gram repetitions over CONTENT words (fillers removed first, so
 * "I um I" still reads as a repeat of "I"). Tries 3-grams → 1-grams so the
 * longest real repeat wins, and counts consecutive runs ("I I I" = count 3).
 */
export function detectRepetitions(words: DisfluencyWord[]): {
  total: number;
  instances: RepetitionInstance[];
} {
  const toks = words
    .filter((w) => !isFillerWord(w))
    .map((w) => ({ text: w.text, start: w.start, n: norm(w.text) }))
    .filter((t) => t.n.length > 0);

  const instances: RepetitionInstance[] = [];
  let i = 0;
  while (i < toks.length) {
    let matched = false;
    for (let n = 3; n >= 1; n--) {
      if (i + 2 * n > toks.length) continue;
      const a = toks.slice(i, i + n).map((t) => t.n).join(" ");
      const b = toks.slice(i + n, i + 2 * n).map((t) => t.n).join(" ");
      if (a === b) {
        let count = 2;
        let j = i + 2 * n;
        while (
          j + n <= toks.length &&
          toks.slice(j, j + n).map((t) => t.n).join(" ") === a
        ) {
          count++;
          j += n;
        }
        instances.push({
          phrase: toks.slice(i, i + n).map((t) => t.text).join(" "),
          count,
          atSec: toks[i]!.start,
        });
        i = j;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  return { total: instances.length, instances };
}

/**
 * False starts / cut-offs. Conservative: only the reliable signal — a vendor
 * `partial` flag or a trailing hyphen/dash on the token ("wa-", "i was—"). Fuller
 * revision/repair detection needs a parser and is deferred (over-detection risk).
 */
export function detectFalseStarts(words: DisfluencyWord[]): {
  total: number;
  instances: FalseStartInstance[];
} {
  const instances: FalseStartInstance[] = [];
  for (const w of words) {
    const raw = w.text.trim();
    if (w.partial === true || /[-–—]$/.test(raw)) {
      instances.push({ fragment: raw, atSec: w.start });
    }
  }
  return { total: instances.length, instances };
}

/**
 * Silent pauses from inter-word timing gaps — ASR-INDEPENDENT (works even off a
 * cleaned transcript, as long as word timings are present). totalSilentSec sums
 * all positive gaps; `instances`/count only the notable ones (>= threshold).
 */
export function measurePauses(
  words: DisfluencyWord[],
  thresholdSec = 0.5
): { count: number; longestSec: number; totalSilentSec: number; instances: PauseInstance[] } {
  const instances: PauseInstance[] = [];
  let totalSilent = 0;
  let longest = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i]!.start - words[i - 1]!.end;
    if (gap > 0) totalSilent += gap;
    if (gap > longest) longest = gap;
    if (gap >= thresholdSec) {
      instances.push({ sec: round1(gap), atSec: round1(words[i - 1]!.end) });
    }
  }
  return {
    count: instances.length,
    longestSec: round1(longest),
    totalSilentSec: round1(totalSilent),
    instances,
  };
}

/** Run the full disfluency analysis over one verbatim, timestamped answer. */
export function analyzeDisfluency(
  words: DisfluencyWord[],
  opts: AnalyzeDisfluencyOptions = {}
): DisfluencyReport {
  const threshold = opts.pauseThresholdSec ?? 0.5;
  const sorted = [...words].sort((a, b) => a.start - b.start);
  const durationSec =
    sorted.length > 0
      ? Math.max(0, sorted[sorted.length - 1]!.end - sorted[0]!.start)
      : 0;
  const pauses = measurePauses(sorted, threshold);
  return {
    wordCount: sorted.length,
    durationSec: round1(durationSec),
    fillers: countFillers(sorted),
    repetitions: detectRepetitions(sorted),
    falseStarts: detectFalseStarts(sorted),
    pauses: {
      ...pauses,
      silentRatio: durationSec > 0 ? round1(pauses.totalSilentSec / durationSec) : 0,
    },
  };
}

/** Adapter helper: lift the existing Whisper `WordTimestamp[]` into the engine's
 * input type. NOTE — Whisper output is NOT verbatim, so fillers/repeats will read
 * low; this exists for the pause path and for tests, not as the real source. */
export function fromWordTimestamps(words: WordTimestamp[]): DisfluencyWord[] {
  return words.map((w) => ({ text: w.word, start: w.start, end: w.end }));
}
