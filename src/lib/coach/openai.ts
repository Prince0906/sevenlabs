import type { WordTimestamp } from "@sevenlabs/shared-types";
import { env } from "@/lib/env";

const OPENAI_BASE = "https://api.openai.com/v1";

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
    const err = await res.text();
    throw new Error(`Whisper failed: ${res.status} ${err}`);
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
    const err = await res.text();
    throw new Error(`GPT coach failed: ${res.status} ${err}`);
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
    const err = await res.text();
    throw new Error(`TTS failed: ${res.status} ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
