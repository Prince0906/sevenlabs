import { type WordTimestamp, REALTIME_INPUT_CONFIG } from "@sevenlabs/shared-types";
import { env } from "@/lib/env";

const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * The PINNED judgment model — used by BOTH per-seat rubric scoring and the
 * committee. Exported so the verdict records which model produced it (provenance
 * for calibration). Never config-driven: cross-session comparability depends on
 * it staying fixed.
 */
export const JUDGE_MODEL = "gpt-4o-mini";

/**
 * Carries a stable code + HTTP status ONLY — never the provider response body,
 * which can echo the Authorization header / account info. This is the BYOK/realtime
 * safety contract: no `await res.text()` into an Error message.
 */
export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(`${code} (status ${status})`);
    this.name = "ProviderError";
  }
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  // Whisper infers the codec from the filename extension, so a webm/mp4 answer
  // must NOT be sent as "utterance.wav" — callers pass a matching name.
  filename: string = "utterance.wav"
): Promise<{ transcript: string; words: WordTimestamp[]; durationSec: number }> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    throw new ProviderError("whisper_failed", res.status);
  }

  const data = (await res.json()) as {
    text?: string;
    duration?: number;
    words?: Array<{ word: string; start: number; end: number }>;
  };

  const words: WordTimestamp[] = (data.words ?? []).map((w) => ({
    word: w.word.trim(),
    start: w.start,
    end: w.end,
  }));

  return {
    transcript: (data.text ?? "").trim(),
    words,
    durationSec: data.duration ?? words.at(-1)?.end ?? 0,
  };
}

export async function scoreAgainstRubric(
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<unknown> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JUDGE_MODEL, // per-seat rubric scoring runs on the pinned judge model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new ProviderError("rubric_scoring_failed", res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    throw new Error("OpenAI returned empty rubric scoring response");
  }
  try {
    return JSON.parse(content);
  } catch {
    // A truncated/malformed model response would otherwise throw a native
    // SyntaxError that reads as a mystery FAILED in the queue logs.
    throw new ProviderError("invalid_json_from_model", 500);
  }
}

/**
 * Resume profile extraction — a PINNED `gpt-4o-mini` JSON call (same plane as
 * judgment: the extracted profile must be consistent across users, never the
 * user's BYOK model). Returns parsed JSON; the route validates every fact's
 * quote against the resume text before anything is stored or shown to a seat.
 */
export async function extractResumeJson(
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<unknown> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // PINNED — never config-driven
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 900,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new ProviderError("resume_extraction_failed", res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = (data.choices?.[0]?.message?.content ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    throw new ProviderError("invalid_json_from_model", 500);
  }
}

/**
 * Mint a short-TTL OpenAI Realtime ephemeral (the only call that sees `sk-`).
 * The persona instructions are config-LOCKED here at mint. The browser opens the
 * WebRTC peer itself with `value` against `realtimeUrl` — Aloud is never in the
 * audio path. TTL is runtime-discovered from `expiresAt`, never hard-coded.
 * (Realtime model is config-driven; the judge model is pinned.)
 */
export async function mintRealtimeEphemeral(params: {
  instructions: string;
  voice: string;
  safetyIdentifier: string;
  // BYOK: the user's decrypted key signs the ephemeral so the realtime minutes
  // bill to their account. Defaults to the house key (trial / no key on file).
  // The raw key lives only in this call frame — never logged, never in an Error.
  apiKey?: string;
}): Promise<{
  value: string;
  expiresAt: number;
  model: string;
  realtimeUrl: string;
}> {
  const res = await fetch(env.OPENAI_REALTIME_MINT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey ?? env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      // Abuse identifier travels as a HEADER on the GA endpoint — passing it in
      // the body returns 400 "Unknown parameter: 'safety_identifier'".
      "OpenAI-Safety-Identifier": params.safetyIdentifier,
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: env.OPENAI_REALTIME_MODEL,
        instructions: params.instructions,
        audio: {
          output: { voice: params.voice },
          // Asserted AT MINT so input transcription + manual turn control can't be
          // forgotten or raced by the client (without it OpenAI emits no transcript
          // events and the judge scores an empty interview). The client re-asserts
          // the same shared config on data-channel open. The full push-to-talk
          // rationale lives on REALTIME_INPUT_CONFIG.
          input: REALTIME_INPUT_CONFIG,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new ProviderError("realtime_mint_failed", res.status);
  }

  // OpenAI has shipped two response shapes; parse defensively, never log the body.
  const data = (await res.json()) as {
    value?: string;
    client_secret?: { value?: string; expires_at?: number };
    expires_at?: number;
  };
  const value = data.value ?? data.client_secret?.value;
  const expiresAt =
    (data.client_secret?.expires_at ?? data.expires_at ?? 0) * 1000; // → unix ms
  if (!value) {
    throw new ProviderError("realtime_mint_no_secret", res.status);
  }
  return {
    value,
    expiresAt,
    model: env.OPENAI_REALTIME_MODEL,
    realtimeUrl: env.OPENAI_REALTIME_URL,
  };
}

/**
 * Committee debrief — a DEDICATED judgment call with raised max_tokens so the
 * verdict prose + rollup never truncates into invalid JSON. The judgment model
 * stays PINNED (never config-driven) for cross-session calibration comparability.
 */
export async function judgeCommittee(
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<unknown> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JUDGE_MODEL, // PINNED — never config-driven
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1200,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new ProviderError("committee_judge_failed", res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = (data.choices?.[0]?.message?.content ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Unguarded, a malformed committee verdict throws SyntaxError → the queue
    // retries 3x → session FAILED with no readable cause. Name it instead.
    throw new ProviderError("invalid_json_from_model", 500);
  }
}
