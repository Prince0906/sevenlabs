import { env } from "./env";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpeechParams {
  text: string;
  voice: string;
  temperature?: number;
  speed?: number;
  exaggeration?: number;
}

export interface ChatterboxVoice {
  voice_id: string;
  name: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (env.CHATTERBOX_API_KEY) {
    headers["Authorization"] = `Bearer ${env.CHATTERBOX_API_KEY}`;
  }

  return headers;
}

// ─── API Client ──────────────────────────────────────────────────────────────

/**
 * Generate speech audio from text using the Chatterbox TTS API.
 * Returns raw audio data as an ArrayBuffer.
 */
export async function synthesizeSpeech(
  params: SpeechParams
): Promise<ArrayBuffer> {
  const response = await fetch(`${env.CHATTERBOX_API_URL}/v1/audio/speech`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: "chatterbox",
      input: params.text,
      voice: params.voice,
      response_format: "wav",
      temperature: params.temperature ?? 0.7,
      speed: params.speed ?? 1.0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Chatterbox API error (${response.status}): ${errorText}`
    );
  }

  return response.arrayBuffer();
}

/**
 * Upload a reference audio clip for voice cloning.
 * Returns the voice name/ID assigned by Chatterbox.
 */
export async function uploadReferenceVoice(
  audioFile: File | Blob,
  voiceName: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioFile);
  formData.append("name", voiceName);

  const headers: Record<string, string> = {};
  if (env.CHATTERBOX_API_KEY) {
    headers["Authorization"] = `Bearer ${env.CHATTERBOX_API_KEY}`;
  }

  const response = await fetch(
    `${env.CHATTERBOX_API_URL}/upload_reference`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Voice upload error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  return data.voice_id ?? data.name ?? voiceName;
}

/**
 * List available voices from the Chatterbox API.
 */
export async function listChatterboxVoices(): Promise<ChatterboxVoice[]> {
  try {
    const response = await fetch(`${env.CHATTERBOX_API_URL}/v1/audio/voices`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.voices ?? [];
  } catch {
    return [];
  }
}
