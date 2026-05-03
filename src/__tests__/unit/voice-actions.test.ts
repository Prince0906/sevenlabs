import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    voice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  uploadAudio: vi.fn().mockResolvedValue("voices/org/test.wav"),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com"),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getVoices, createCustomVoice, deleteCustomVoice } from "@/features/voices/actions";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Voice Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVoices", () => {
    it("should return empty array when user has no organization", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null } as never);

      const voices = await getVoices();
      expect(voices).toEqual([]);
    });

    it("should query both system and custom voices for the org", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.voice.findMany).mockResolvedValueOnce([]);

      await getVoices();

      expect(prisma.voice.findMany).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(prisma.voice.findMany).mock.calls[0][0];
      expect(callArgs?.where?.OR).toEqual([
        { variant: "SYSTEM" },
        { variant: "CUSTOM", orgId: "org-123" },
      ]);
    });

    it("should apply language filter when provided", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.voice.findMany).mockResolvedValueOnce([]);

      await getVoices({ language: "hi" });

      const callArgs = vi.mocked(prisma.voice.findMany).mock.calls[0][0];
      expect(callArgs?.where?.language).toBe("hi");
    });
  });

  describe("createCustomVoice", () => {
    it("should reject when no organization", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null } as never);

      const formData = new FormData();
      const result = await createCustomVoice(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization required");
    });

    it("should reject when audio file is missing", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);

      const formData = new FormData();
      formData.set("name", "Test Voice");
      const result = await createCustomVoice(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Audio file is required");
    });

    it("should reject when voice name is empty", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);

      const formData = new FormData();
      formData.set("audio", new Blob(["audio"]), "test.wav");
      formData.set("name", "  "); // whitespace only
      const result = await createCustomVoice(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice name is required");
    });

    it("should reject files larger than 10MB", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);

      // Create a blob larger than 10MB
      const largeBlob = new Blob([new Uint8Array(11 * 1024 * 1024)]);
      const formData = new FormData();
      formData.set("audio", largeBlob, "large.wav");
      formData.set("name", "Large Voice");
      const result = await createCustomVoice(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Audio file must be under 10MB");
    });
  });

  describe("deleteCustomVoice", () => {
    it("should reject when no organization", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null } as never);

      const result = await deleteCustomVoice("voice-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Organization required");
    });

    it("should return error when voice not found", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: "org-123" } as never);
      vi.mocked(prisma.voice.findFirst).mockResolvedValueOnce(null);

      const result = await deleteCustomVoice("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice not found or cannot be deleted");
    });
  });
});
