import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/generate/route";

const mockFindUnique = vi.fn();
const mockGenerationCreate = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    voice: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    generation: {
      create: (...args: unknown[]) => mockGenerationCreate(...args),
    },
  },
}));

vi.mock("@/lib/mock-tts", () => ({
  generateMockAudio: vi.fn().mockResolvedValue({
    filename: "gen_test_abc123.wav",
    audioUrl: "/audio/gen_test_abc123.wav",
  }),
}));

import { auth } from "@clerk/nextjs/server";
const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/generate", () => {
  const validBody = {
    text: "Hello world",
    voiceId: "v1",
    temperature: 0.7,
    topP: 0.9,
    topK: 50,
    repetitionPenalty: 1.0,
  };

  function makeRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ orgId: null } as never);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when text is missing", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const res = await POST(makeRequest({ voiceId: "v1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Text is required");
  });

  it("returns 400 when voiceId is missing", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const res = await POST(makeRequest({ text: "Hello" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Voice is required");
  });

  it("returns 404 when voice is not found", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Voice not found");
  });

  it("creates a generation and returns audio URL", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);
    mockFindUnique.mockResolvedValue({ id: "v1", name: "Rachel" });

    const generation = {
      id: "gen_1",
      orgId: "org_123",
      voiceId: "v1",
      text: "Hello world",
      voiceName: "Rachel",
      r2ObjectKey: "gen_test_abc123.wav",
      temperature: 0.7,
      topP: 0.9,
      topK: 50,
      repetitionPenalty: 1.0,
      voice: { id: "v1", name: "Rachel" },
    };
    mockGenerationCreate.mockResolvedValue(generation);

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.audioUrl).toBe("/audio/gen_test_abc123.wav");
    expect(body.voiceName).toBe("Rachel");
    expect(mockGenerationCreate).toHaveBeenCalledWith({
      data: {
        orgId: "org_123",
        voiceId: "v1",
        text: "Hello world",
        voiceName: "Rachel",
        r2ObjectKey: "gen_test_abc123.wav",
        temperature: 0.7,
        topP: 0.9,
        topK: 50,
        repetitionPenalty: 1.0,
      },
      include: { voice: true },
    });
  });

  it("uses default parameter values when not provided", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);
    mockFindUnique.mockResolvedValue({ id: "v1", name: "Rachel" });
    mockGenerationCreate.mockResolvedValue({
      id: "gen_2",
      voiceName: "Rachel",
      voice: { id: "v1", name: "Rachel" },
    });

    const res = await POST(
      makeRequest({ text: "Hello", voiceId: "v1" })
    );

    expect(res.status).toBe(200);
    expect(mockGenerationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          temperature: 0.7,
          topP: 0.9,
          topK: 50,
          repetitionPenalty: 1.0,
        }),
      })
    );
  });
});
