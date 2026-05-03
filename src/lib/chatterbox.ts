import Replicate from "replicate";
import { env } from "./env";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpeechParams {
  text: string;
  language?: string;
  temperature?: number;
  exaggeration?: number;
  referenceAudioUrl?: string;
}

// ─── Replicate Client ────────────────────────────────────────────────────────

const replicate = new Replicate({
  auth: env.REPLICATE_API_TOKEN,
});

// Chatterbox Multilingual — supports 23 languages including Hindi
const MODEL_ID =
  "resemble-ai/chatterbox-multilingual:9cfba4c265e685f840612be835424f8c33bdee685d7466ece7684b0d9d4c0b1c";

// Map our language codes to Chatterbox language IDs
function getLanguageId(lang?: string): string {
  if (!lang) return "en";
  if (lang.startsWith("hi")) return "hi";
  if (lang.startsWith("en")) return "en";
  return lang.split("-")[0]; // "en-US" → "en"
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Generate speech audio from text using Chatterbox Multilingual via Replicate.
 * Returns raw audio data as an ArrayBuffer.
 */
export async function synthesizeSpeech(
  params: SpeechParams
): Promise<ArrayBuffer> {
  try {
    const input: Record<string, unknown> = {
      text: params.text,
      language: getLanguageId(params.language),
    };

    // Optional: reference audio for voice cloning
    if (params.referenceAudioUrl) {
      input.reference_audio = params.referenceAudioUrl;
    }

    console.log("[synthesizeSpeech] Calling Replicate with language:", input.language);

    const output = await replicate.run(MODEL_ID, { input });

    // output is a FileOutput — use .url() to get the URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileOutput = output as any;

    let audioUrl: string;
    if (typeof fileOutput?.url === "function") {
      audioUrl = fileOutput.url();
    } else if (typeof fileOutput === "string") {
      audioUrl = fileOutput;
    } else if (fileOutput instanceof URL) {
      audioUrl = fileOutput.toString();
    } else {
      // Try to read as buffer directly
      const buffer = Buffer.from(fileOutput);
      if (buffer.length > 0) return buffer.buffer;
      throw new Error(`Unexpected output type: ${typeof fileOutput}`);
    }

    console.log("[synthesizeSpeech] Audio URL:", audioUrl);

    // Download the audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error("[synthesizeSpeech] Replicate error:", error);
    throw new Error(
      error instanceof Error
        ? `TTS generation failed: ${error.message}`
        : "TTS generation failed"
    );
  }
}
