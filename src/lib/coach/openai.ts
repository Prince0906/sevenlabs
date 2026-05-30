import type { WordTimestamp } from "@sevenlabs/shared-types";
import { env } from "@/lib/env";

const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * Carries a stable code + HTTP status ONLY — never the provider response body,
 * which can echo the Authorization header / account info. This is the BYOK/realtime
 * safety contract (SYSTEM_DESIGN §16): no `await res.text()` into an Error message.
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
  mimeType: string
): Promise<{ transcript: string; words: WordTimestamp[]; durationSec: number }> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
  formData.append("file", blob, "utterance.wav");
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

export async function generateCoachText(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 120,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new ProviderError("coach_text_failed", res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    throw new Error("OpenAI returned empty coach text");
  }
  return content;
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
      model: "gpt-4o-mini",
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
  return JSON.parse(content);
}

export async function synthesizeCoachSpeech(text: string): Promise<Buffer> {
  const res = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "nova",
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    throw new ProviderError("tts_failed", res.status);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Mint a short-TTL OpenAI Realtime ephemeral (the only call that sees `sk-`).
 * The persona instructions are config-LOCKED here at mint. The browser opens the
 * WebRTC peer itself with `value` against `realtimeUrl` — Aloud is never in the
 * audio path. TTL is runtime-discovered from `expiresAt`, never hard-coded.
 * (SYSTEM_DESIGN §10. Realtime model is config-driven; the judge model is pinned.)
 */
export async function mintRealtimeEphemeral(params: {
  instructions: string;
  voice: string;
  safetyIdentifier: string;
}): Promise<{
  value: string;
  expiresAt: number;
  model: string;
  realtimeUrl: string;
}> {
  const res = await fetch(env.OPENAI_REALTIME_MINT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: env.OPENAI_REALTIME_MODEL,
        instructions: params.instructions,
        audio: { output: { voice: params.voice } },
      },
      safety_identifier: params.safetyIdentifier,
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
 * (SYSTEM_DESIGN §8.3)
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
      model: "gpt-4o-mini", // PINNED — never config-driven
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
  return JSON.parse((data.choices?.[0]?.message?.content ?? "").trim());
}
