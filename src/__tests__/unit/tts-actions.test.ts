import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    voice: { findUnique: vi.fn() },
    generation: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/chatterbox", () => ({
  synthesizeSpeech: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  uploadAudio: vi.fn().mockResolvedValue("generations/org/test.wav"),
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example.com/audio.wav"),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { synthesizeSpeech } from "@/lib/chatterbox";
import { generateSpeech, getGenerations } from "@/features/text-to-speech/actions";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Text-to-Speech Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSpeech", () => {
    it("should require organization authentication", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null } as never);

      const result = await generateSpeech({
        text: "Hello",
        voiceId: "voice-1",
        voiceName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization required");
    });

    it("should reject empty text", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);

      const result = await generateSpeech({
        text: "   ",
        voiceId: "voice-1",
        voiceName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Text is required");
    });

    it("should reject text exceeding 5000 characters", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);

      const result = await generateSpeech({
        text: "x".repeat(5001),
        voiceId: "voice-1",
        voiceName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Text exceeds 5000 character limit");
    });

    it("should orchestrate TTS pipeline: voice lookup → synthesize → upload → save", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.voice.findUnique).mockResolvedValueOnce({
        chatterboxVoiceId: null,
        name: "Default",
        language: "en-US",
      } as never);
      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new ArrayBuffer(2048));
      vi.mocked(prisma.generation.create).mockResolvedValueOnce({
        id: "gen-001",
      } as never);

      const result = await generateSpeech({
        text: "Generate this speech",
        voiceId: "voice-1",
        voiceName: "Default",
        language: "en-US",
      });

      expect(result.success).toBe(true);
      expect(result.generationId).toBe("gen-001");
      expect(result.audioUrl).toBe("https://signed.example.com/audio.wav");

      // Verify full pipeline
      expect(prisma.voice.findUnique).toHaveBeenCalledTimes(1);
      expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
      expect(prisma.generation.create).toHaveBeenCalledTimes(1);
    });

    it("should pass language to synthesizeSpeech", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.voice.findUnique).mockResolvedValueOnce({
        chatterboxVoiceId: null,
        name: "Hindi Voice",
        language: "hi",
      } as never);
      vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new ArrayBuffer(1024));
      vi.mocked(prisma.generation.create).mockResolvedValueOnce({
        id: "gen-002",
      } as never);

      await generateSpeech({
        text: "नमस्ते दुनिया",
        voiceId: "voice-2",
        voiceName: "Hindi Voice",
        language: "hi",
      });

      expect(synthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ language: "hi" })
      );
    });

    it("should return error when TTS fails", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.voice.findUnique).mockResolvedValueOnce({
        chatterboxVoiceId: null,
        name: "Voice",
        language: "en",
      } as never);
      vi.mocked(synthesizeSpeech).mockRejectedValueOnce(
        new Error("TTS generation failed: Rate limit")
      );

      const result = await generateSpeech({
        text: "This will fail",
        voiceId: "voice-1",
        voiceName: "Voice",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit");
    });
  });

  describe("getGenerations", () => {
    it("should return empty array when no organization", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null } as never);

      const result = await getGenerations();
      expect(result).toEqual([]);
    });

    it("should fetch generations ordered by most recent", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.generation.findMany).mockResolvedValueOnce([]);

      await getGenerations(5);

      expect(prisma.generation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "org-123" },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      );
    });
  });
});
