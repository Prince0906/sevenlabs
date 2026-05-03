"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { synthesizeSpeech } from "@/lib/chatterbox";
import { uploadAudio, getSignedUrl } from "@/lib/s3";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GenerateSpeechInput {
  text: string;
  voiceId: string;
  voiceName: string;
  language?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
}

interface GenerateSpeechResult {
  success: boolean;
  generationId?: string;
  audioUrl?: string;
  error?: string;
}

interface GenerationWithAudio {
  id: string;
  text: string;
  voiceName: string;
  language: string;
  temperature: number;
  topP: number;
  topK: number;
  repetitionPenalty: number;
  durationMs: number | null;
  audioUrl: string | null;
  createdAt: Date;
  voice: {
    id: string;
    name: string;
    category: string;
  } | null;
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Generate speech from text using Chatterbox TTS.
 * Uploads result to R2 and saves a Generation record.
 */
export async function generateSpeech(
  input: GenerateSpeechInput
): Promise<GenerateSpeechResult> {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return { success: false, error: "Organization required" };
    }

    // Validate input
    if (!input.text.trim()) {
      return { success: false, error: "Text is required" };
    }

    if (input.text.length > 5000) {
      return { success: false, error: "Text exceeds 5000 character limit" };
    }

    // Look up the voice to get reference audio URL (for custom cloned voices)
    const voice = await prisma.voice.findUnique({
      where: { id: input.voiceId },
      select: { chatterboxVoiceId: true, name: true, language: true },
    });

    // Call Chatterbox TTS via Replicate
    const audioBuffer = await synthesizeSpeech({
      text: input.text,
      language: input.language ?? voice?.language ?? "en-US",
      temperature: input.temperature ?? 0.8,
      exaggeration: 0.5,
      // If voice has a reference audio URL (custom cloned voice), pass it
      referenceAudioUrl: voice?.chatterboxVoiceId?.startsWith("http")
        ? voice.chatterboxVoiceId
        : undefined,
    });

    // Upload to S3
    const s3Key = `generations/${orgId}/${Date.now()}.wav`;
    await uploadAudio(s3Key, Buffer.from(audioBuffer), "audio/wav");

    // Save generation record
    const generation = await prisma.generation.create({
      data: {
        orgId,
        voiceId: input.voiceId,
        text: input.text,
        voiceName: input.voiceName,
        language: input.language ?? "en-US",
        r2ObjectKey: s3Key,
        temperature: input.temperature ?? 0.7,
        topP: input.topP ?? 0.9,
        topK: input.topK ?? 50,
        repetitionPenalty: input.repetitionPenalty ?? 1.1,
      },
    });

    // Get signed URL for immediate playback
    const audioUrl = await getSignedUrl(s3Key);

    return {
      success: true,
      generationId: generation.id,
      audioUrl,
    };
  } catch (error) {
    console.error("[generateSpeech] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate speech",
    };
  }
}

/**
 * Fetch recent generations for the current org.
 */
export async function getGenerations(
  limit: number = 10
): Promise<GenerationWithAudio[]> {
  const { orgId } = await auth();
  if (!orgId) return [];

  const generations = await prisma.generation.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      voice: {
        select: { id: true, name: true, category: true },
      },
    },
  });

  // Generate signed URLs for each generation's audio
  const result = await Promise.all(
    generations.map(async (gen) => ({
      id: gen.id,
      text: gen.text,
      voiceName: gen.voiceName,
      language: gen.language,
      temperature: gen.temperature,
      topP: gen.topP,
      topK: gen.topK,
      repetitionPenalty: gen.repetitionPenalty,
      durationMs: gen.durationMs,
      audioUrl: gen.r2ObjectKey
        ? await getSignedUrl(gen.r2ObjectKey)
        : null,
      createdAt: gen.createdAt,
      voice: gen.voice,
    }))
  );

  return result;
}

/**
 * Fetch a single generation with its audio URL.
 */
export async function getGeneration(
  id: string
): Promise<GenerationWithAudio | null> {
  const { orgId } = await auth();
  if (!orgId) return null;

  const gen = await prisma.generation.findFirst({
    where: { id, orgId },
    include: {
      voice: {
        select: { id: true, name: true, category: true },
      },
    },
  });

  if (!gen) return null;

  return {
    id: gen.id,
    text: gen.text,
    voiceName: gen.voiceName,
    language: gen.language,
    temperature: gen.temperature,
    topP: gen.topP,
    topK: gen.topK,
    repetitionPenalty: gen.repetitionPenalty,
    durationMs: gen.durationMs,
    audioUrl: gen.r2ObjectKey
      ? await getSignedUrl(gen.r2ObjectKey)
      : null,
    createdAt: gen.createdAt,
    voice: gen.voice,
  };
}
