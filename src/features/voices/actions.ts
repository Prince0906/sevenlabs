"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { uploadReferenceVoice } from "@/lib/chatterbox";
import { uploadAudio, deleteObject } from "@/lib/r2";
import type { VoiceCategory } from "@/generated/prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoiceFilters {
  category?: VoiceCategory;
  language?: string;
  variant?: "SYSTEM" | "CUSTOM";
  search?: string;
}

export interface VoiceItem {
  id: string;
  name: string;
  description: string | null;
  category: VoiceCategory;
  language: string;
  variant: "SYSTEM" | "CUSTOM";
  previewText: string | null;
  chatterboxVoiceId: string | null;
  createdAt: Date;
}

interface CreateVoiceResult {
  success: boolean;
  voiceId?: string;
  error?: string;
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * List voices — system voices (visible to all) + org's custom voices.
 */
export async function getVoices(
  filters?: VoiceFilters
): Promise<VoiceItem[]> {
  const { orgId } = await auth();
  if (!orgId) return [];

  // Build where clause: system voices OR this org's custom voices
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    OR: [
      { variant: "SYSTEM" },
      { variant: "CUSTOM", orgId },
    ],
  };

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.language) {
    where.language = filters.language;
  }

  if (filters?.variant) {
    // Override the OR clause to filter by specific variant
    if (filters.variant === "SYSTEM") {
      where.OR = [{ variant: "SYSTEM" }];
    } else {
      where.OR = [{ variant: "CUSTOM", orgId }];
    }
  }

  if (filters?.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  const voices = await prisma.voice.findMany({
    where,
    orderBy: [{ variant: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      language: true,
      variant: true,
      previewText: true,
      chatterboxVoiceId: true,
      createdAt: true,
    },
  });

  return voices;
}

/**
 * Get a single voice by ID.
 */
export async function getVoice(id: string): Promise<VoiceItem | null> {
  const { orgId } = await auth();
  if (!orgId) return null;

  const voice = await prisma.voice.findFirst({
    where: {
      id,
      OR: [
        { variant: "SYSTEM" },
        { variant: "CUSTOM", orgId },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      language: true,
      variant: true,
      previewText: true,
      chatterboxVoiceId: true,
      createdAt: true,
    },
  });

  return voice;
}

/**
 * Create a custom cloned voice.
 * Uploads reference audio to Chatterbox for cloning, stores in R2, saves to DB.
 */
export async function createCustomVoice(
  formData: FormData
): Promise<CreateVoiceResult> {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return { success: false, error: "Organization required" };
    }

    const audioFile = formData.get("audio") as File | null;
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const category = (formData.get("category") as VoiceCategory) || "GENERAL";
    const language = (formData.get("language") as string) || "en-US";

    if (!audioFile) {
      return { success: false, error: "Audio file is required" };
    }

    if (!name?.trim()) {
      return { success: false, error: "Voice name is required" };
    }

    // Validate file size (max 10MB)
    if (audioFile.size > 10 * 1024 * 1024) {
      return { success: false, error: "Audio file must be under 10MB" };
    }

    // Upload reference audio to Chatterbox for voice cloning
    const chatterboxVoiceId = await uploadReferenceVoice(audioFile, name);

    // Also store the reference audio in R2 for backup
    const r2Key = `voices/${orgId}/${Date.now()}-${name.toLowerCase().replace(/\s+/g, "-")}.wav`;
    const audioArrayBuffer = await audioFile.arrayBuffer();
    await uploadAudio(r2Key, Buffer.from(audioArrayBuffer), audioFile.type || "audio/wav");

    // Save to database
    const voice = await prisma.voice.create({
      data: {
        orgId,
        name: name.trim(),
        description,
        category,
        language,
        variant: "CUSTOM",
        r2ObjectKey: r2Key,
        chatterboxVoiceId,
        previewText:
          language === "hi"
            ? "नमस्ते, मैं आपकी क्लोन की गई आवाज़ हूँ।"
            : "Hello, I am your cloned voice. How does it sound?",
      },
    });

    return { success: true, voiceId: voice.id };
  } catch (error) {
    console.error("[createCustomVoice] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create voice",
    };
  }
}

/**
 * Delete a custom voice (only if owned by the org).
 */
export async function deleteCustomVoice(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return { success: false, error: "Organization required" };
    }

    const voice = await prisma.voice.findFirst({
      where: { id, orgId, variant: "CUSTOM" },
    });

    if (!voice) {
      return { success: false, error: "Voice not found or cannot be deleted" };
    }

    // Delete R2 object if exists
    if (voice.r2ObjectKey) {
      await deleteObject(voice.r2ObjectKey).catch(console.error);
    }

    // Delete from database
    await prisma.voice.delete({ where: { id } });

    return { success: true };
  } catch (error) {
    console.error("[deleteCustomVoice] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete voice",
    };
  }
}
