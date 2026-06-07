import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn() },
  mockTurn: { updateMany: vi.fn() },
}));
const mockOpenai = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  ProviderError: class ProviderError extends Error {
    status: number;
    constructor(status = 500) {
      super("provider");
      this.status = status;
    }
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/coach/openai", () => mockOpenai);
vi.mock("@sevenlabs/coach-core", () => ({
  analyzeSpeech: vi.fn().mockReturnValue({ wpm: 120, fillerCount: 1 }),
}));

import { auth } from "@/lib/auth";
import { POST, audioExt } from "@/app/api/mock/sessions/[id]/turns/audio/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function audioReq(opts: { clientTurnId?: string; audio?: Blob }): Request {
  const fd = new FormData();
  if (opts.clientTurnId !== undefined) fd.set("clientTurnId", opts.clientTurnId);
  if (opts.audio !== undefined) fd.set("audio", opts.audio);
  return new Request("http://localhost/api/mock/sessions/s1/turns/audio", {
    method: "POST",
    body: fd,
  });
}
const wav = (bytes = 4, type = "audio/webm") =>
  new Blob([new Uint8Array(bytes)], { type });

describe("audioExt (mime → codec extension)", () => {
  it.each([
    ["audio/webm;codecs=opus", "webm"],
    ["audio/ogg", "ogg"],
    ["audio/wav", "wav"],
    ["audio/mpeg", "mp3"],
    ["audio/mp3", "mp3"],
    ["audio/mp4", "mp4"],
    ["audio/m4a", "mp4"],
    ["audio/aac", "mp4"],
    ["application/octet-stream", "webm"], // unknown → webm fallback
  ])("%s → %s", (mime, ext) => {
    expect(audioExt(mime)).toBe(ext);
  });
});

describe("POST /api/mock/sessions/:id/turns/audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "LIVE" });
    mockOpenai.transcribeAudio.mockResolvedValue({
      words: [
        { word: "a", start: 0, end: 0.5 },
        { word: "b", start: 0.6, end: 1 },
      ],
      durationSec: 1,
    });
    mockPrisma.mockTurn.updateMany.mockResolvedValue({ count: 1 });
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(401);
  });

  it("404 when session not owned", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValueOnce(null);
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(404);
  });

  it("409 when the session is not LIVE", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValueOnce({ status: "COMPLETED" });
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(409);
  });

  it("400 when the audio file is missing", async () => {
    const res = await POST(audioReq({ clientTurnId: "c1" }), params("s1"));
    expect(res.status).toBe(400);
  });

  it("400 on an empty (zero-byte) upload", async () => {
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav(0) }), params("s1"));
    expect(res.status).toBe(400);
  });

  it("does NOT 500 when Whisper fails — soft {ok:false} so the interview survives", async () => {
    mockOpenai.transcribeAudio.mockRejectedValueOnce(new Error("whisper down"));
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "transcription_failed" });
    expect(mockPrisma.mockTurn.updateMany).not.toHaveBeenCalled();
  });

  it("202 pending when the text turn row isn't written yet (client retries)", async () => {
    mockPrisma.mockTurn.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ pending: true });
  });

  it("200 ok and attaches metrics to the matching USER turn", async () => {
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockPrisma.mockTurn.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "s1", clientTurnId: "c1", role: "USER" },
      })
    );
  });
});
