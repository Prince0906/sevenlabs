import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock AWS SDK ────────────────────────────────────────────────────────────

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mockSend;
  },
  PutObjectCommand: class MockPut {
    constructor(params: Record<string, unknown>) {
      Object.assign(this, params);
    }
  },
  GetObjectCommand: class MockGet {
    constructor(params: Record<string, unknown>) {
      Object.assign(this, params);
    }
  },
  DeleteObjectCommand: class MockDelete {
    constructor(params: Record<string, unknown>) {
      Object.assign(this, params);
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/signed-url"),
}));

vi.mock("@/lib/env", () => ({
  env: {
    AWS_ACCESS_KEY_ID: "test-key",
    AWS_SECRET_ACCESS_KEY: "test-secret",
    AWS_REGION: "us-east-1",
    S3_BUCKET_NAME: "test-bucket",
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { uploadAudio, getSignedUrl, deleteObject } from "@/lib/s3";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("S3 Storage Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadAudio", () => {
    it("should upload audio buffer with correct bucket and key", async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from("fake-audio-data");
      const key = "generations/org-123/1234567890.wav";
      await uploadAudio(key, buffer, "audio/wav");

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Bucket).toBe("test-bucket");
      expect(command.Key).toBe(key);
      expect(command.ContentType).toBe("audio/wav");
    });

    it("should return the S3 key after upload", async () => {
      mockSend.mockResolvedValueOnce({});

      const key = "generations/org-456/audio.wav";
      const result = await uploadAudio(key, Buffer.from("data"));

      expect(result).toBe(key);
    });

    it("should throw when S3 upload fails", async () => {
      mockSend.mockRejectedValueOnce(new Error("Access Denied"));

      await expect(
        uploadAudio("key.wav", Buffer.from("data"))
      ).rejects.toThrow("Access Denied");
    });
  });

  describe("getSignedUrl", () => {
    it("should generate a pre-signed URL for audio download", async () => {
      const url = await getSignedUrl("generations/org-123/audio.wav");

      expect(url).toBe("https://s3.example.com/signed-url");
    });

    it("should accept custom expiry time", async () => {
      const url = await getSignedUrl("key.wav", 7200);

      expect(url).toBe("https://s3.example.com/signed-url");
    });
  });

  describe("deleteObject", () => {
    it("should delete object from S3 with correct key", async () => {
      mockSend.mockResolvedValueOnce({});

      await deleteObject("voices/org-123/sample.wav");

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.Bucket).toBe("test-bucket");
      expect(command.Key).toBe("voices/org-123/sample.wav");
    });

    it("should throw when delete fails", async () => {
      mockSend.mockRejectedValueOnce(new Error("NoSuchKey"));

      await expect(
        deleteObject("nonexistent.wav")
      ).rejects.toThrow("NoSuchKey");
    });
  });
});
