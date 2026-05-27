import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  practiceSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  practiceTurn: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/s3", () => ({
  uploadAudio: vi.fn().mockResolvedValue("key"),
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/audio"),
}));
vi.mock("@/lib/coach/openai", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    transcript: "hello world",
    words: [{ word: "hello", start: 0, end: 0.5 }],
    durationSec: 2,
  }),
  generateCoachText: vi.fn().mockResolvedValue("Slow down slightly."),
  synthesizeCoachSpeech: vi.fn().mockResolvedValue(Buffer.from("mp3")),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "test",
    S3_BUCKET_NAME: "bucket",
    AWS_ACCESS_KEY_ID: "k",
    AWS_SECRET_ACCESS_KEY: "s",
    AWS_REGION: "us-east-1",
  },
}));

import {
  createPracticeSession,
  processTurn,
} from "@/lib/coach/turn-orchestrator";

describe("Practice session (user-scoped)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates session scoped to userId", async () => {
    mockPrisma.practiceSession.create.mockResolvedValue({
      id: "sess_1",
      userId: "user_1",
    });
    mockPrisma.practiceTurn.create.mockResolvedValue({});

    const result = await createPracticeSession("user_1");

    expect(mockPrisma.practiceSession.create).toHaveBeenCalledWith({
      data: { userId: "user_1", mode: "delivery" },
    });
    expect(result.sessionId).toBe("sess_1");
  });

  it("rejects cross-user session on processTurn", async () => {
    // Session exists but belongs to a different user → findFirst returns null
    // because the where clause includes `userId`.
    mockPrisma.practiceSession.findFirst.mockResolvedValue(null);

    await expect(
      processTurn({
        userId: "user_2",
        sessionId: "sess_1",
        clientTurnId: "turn_1",
        audioBuffer: Buffer.from("x"),
        mimeType: "audio/webm",
      })
    ).rejects.toThrow("SESSION_NOT_FOUND");

    // Verify the user-scoped filter was applied.
    expect(mockPrisma.practiceSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_2" }),
      })
    );
  });

  it("returns duplicate when clientTurnId exists", async () => {
    mockPrisma.practiceSession.findFirst.mockResolvedValue({
      id: "sess_1",
      userId: "user_1",
      turns: [],
    });
    mockPrisma.practiceTurn.findUnique.mockResolvedValue({
      id: "existing",
      transcript: "hi",
      metricsJson: { wpm: 120 },
      createdAt: new Date(),
    });
    mockPrisma.practiceTurn.findFirst.mockResolvedValue({
      coachText: "Nice pace.",
      audioKey: "coach-key",
    });

    const result = await processTurn({
      userId: "user_1",
      sessionId: "sess_1",
      clientTurnId: "turn_1",
      audioBuffer: Buffer.from("x"),
      mimeType: "audio/webm",
    });

    expect(result.duplicate).toBe(true);
    expect(result.transcript).toBe("hi");
  });
});
