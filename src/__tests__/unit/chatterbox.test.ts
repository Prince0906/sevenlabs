import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Replicate SDK ──────────────────────────────────────────────────────

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }));

vi.mock("replicate", () => ({
  default: class MockReplicate {
    run = mockRun;
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    REPLICATE_API_TOKEN: "test-token",
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { synthesizeSpeech } from "@/lib/chatterbox";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Chatterbox TTS Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    global.fetch = vi.fn();
  });

  describe("synthesizeSpeech", () => {
    it("should call Replicate with correct model and text input", async () => {
      // Mock Replicate output — FileOutput with .url() method
      const mockOutput = {
        url: () => "https://replicate.delivery/output.wav",
      };
      mockRun.mockResolvedValueOnce(mockOutput);

      // Mock fetch for downloading the audio
      const mockAudioBuffer = new ArrayBuffer(1024);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      });

      const result = await synthesizeSpeech({ text: "Hello world" });

      // Verify Replicate was called with correct params
      expect(mockRun).toHaveBeenCalledTimes(1);
      const [modelId, options] = mockRun.mock.calls[0];

      expect(modelId).toContain("resemble-ai/chatterbox-multilingual");
      expect(options.input.text).toBe("Hello world");
      expect(options.input.language).toBe("en");
      expect(result).toBe(mockAudioBuffer);
    });

    it("should detect Hindi language from 'hi' prefix", async () => {
      const mockOutput = { url: () => "https://example.com/audio.wav" };
      mockRun.mockResolvedValueOnce(mockOutput);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(512)),
      });

      await synthesizeSpeech({ text: "नमस्ते दुनिया", language: "hi-IN" });

      const [, options] = mockRun.mock.calls[0];
      expect(options.input.language).toBe("hi");
    });

    it("should include reference_audio when referenceAudioUrl is provided", async () => {
      const refUrl = "https://example.com/voice-sample.wav";
      const mockOutput = { url: () => "https://example.com/output.wav" };
      mockRun.mockResolvedValueOnce(mockOutput);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(256)),
      });

      await synthesizeSpeech({
        text: "Clone this voice",
        referenceAudioUrl: refUrl,
      });

      const [, options] = mockRun.mock.calls[0];
      expect(options.input.reference_audio).toBe(refUrl);
    });

    it("should throw a descriptive error when Replicate API fails", async () => {
      mockRun.mockRejectedValueOnce(new Error("Rate limit exceeded"));

      await expect(
        synthesizeSpeech({ text: "This will fail" })
      ).rejects.toThrow("TTS generation failed: Rate limit exceeded");
    });

    it("should throw when audio download fails", async () => {
      const mockOutput = { url: () => "https://example.com/bad.wav" };
      mockRun.mockResolvedValueOnce(mockOutput);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        synthesizeSpeech({ text: "Download will fail" })
      ).rejects.toThrow("Failed to download audio: 500");
    });

    it("should handle string output from Replicate", async () => {
      mockRun.mockResolvedValueOnce("https://replicate.delivery/direct.wav");
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(128)),
      });

      const result = await synthesizeSpeech({ text: "Direct URL" });
      expect(result.byteLength).toBe(128);
    });
  });
});
