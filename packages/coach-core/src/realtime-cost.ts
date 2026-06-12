/**
 * Spend estimation for BYOK realtime sessions (INTERVIEW_ENGINE_PLAN §3.7).
 *
 * The realtime API emits a `usage` object on every `response.done`; summing it
 * gives an HONEST running cost (realtime re-bills accumulated context each turn,
 * and the usage reflects that). This is a DISPLAY ESTIMATE only — the user is
 * billed by OpenAI directly against their own key; the meter exists so the
 * horror-story bill is visible before it happens, never to charge anyone.
 *
 * Prices are gpt-realtime, USD per token (verified 2026-06). Update this one
 * constant when OpenAI changes pricing — nothing else depends on the numbers.
 */
export const REALTIME_PRICES = {
  audioInput: 32 / 1e6, // $32 / 1M tokens
  audioInputCached: 0.4 / 1e6, // $0.40 / 1M (98.75% cache discount)
  textInput: 4 / 1e6, // $4 / 1M
  textInputCached: 0.4 / 1e6,
  audioOutput: 64 / 1e6, // $64 / 1M
  textOutput: 16 / 1e6, // $16 / 1M
};

export interface RealtimeUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number };
  };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

const P = REALTIME_PRICES;

/**
 * Estimated USD cost of one realtime response from its usage. Uses the detailed
 * token breakdown (with the cached-token discount) when present; falls back to
 * the coarse input/output totals at the dominant audio rate otherwise. Never
 * negative; null/garbage usage costs 0.
 */
export function turnCostUsd(usage: RealtimeUsage | null | undefined): number {
  if (!usage) return 0;
  const ind = usage.input_token_details;
  const outd = usage.output_token_details;

  if (ind || outd) {
    const cachedAudio = ind?.cached_tokens_details?.audio_tokens ?? 0;
    const cachedText = ind?.cached_tokens_details?.text_tokens ?? 0;
    const audioIn = Math.max(0, (ind?.audio_tokens ?? 0) - cachedAudio);
    const textIn = Math.max(0, (ind?.text_tokens ?? 0) - cachedText);
    return (
      audioIn * P.audioInput +
      cachedAudio * P.audioInputCached +
      textIn * P.textInput +
      cachedText * P.textInputCached +
      (outd?.audio_tokens ?? 0) * P.audioOutput +
      (outd?.text_tokens ?? 0) * P.textOutput
    );
  }

  // No breakdown: approximate with totals at the audio rate (the dominant cost).
  return (
    Math.max(0, usage.input_tokens ?? 0) * P.audioInput +
    Math.max(0, usage.output_tokens ?? 0) * P.audioOutput
  );
}
