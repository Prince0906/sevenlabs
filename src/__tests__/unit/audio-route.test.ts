import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn() },
  mockTurn: { update: vi.fn() },
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

const mockDeepgram = vi.hoisted(() => ({
  isDeepgramConfigured: vi.fn(() => false),
  transcribeVerbatim: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/providers/openai", () => mockOpenai);
vi.mock("@/lib/providers/deepgram", () => mockDeepgram);
vi.mock("@sevenlabs/panel-core", () => ({
  analyzeSpeech: vi.fn().mockReturnValue({ wpm: 120, fillerCount: 1 }),
  analyzeDisfluency: vi.fn().mockReturnValue({ fillers: { total: 2 }, repetitions: { total: 1 } }),
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
    mockDeepgram.isDeepgramConfigured.mockReturnValue(false); // default: Whisper path
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "LIVE" });
    mockOpenai.transcribeAudio.mockResolvedValue({
      words: [
        { word: "a", start: 0, end: 0.5 },
        { word: "b", start: 0.6, end: 1 },
      ],
      durationSec: 1,
    });
    mockPrisma.mockTurn.update.mockResolvedValue({ id: "t1" });
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
    expect(mockPrisma.mockTurn.update).not.toHaveBeenCalled();
  });

  it("202 pending when the text turn row isn't written yet (P2025 → client retries)", async () => {
    mockPrisma.mockTurn.update.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "P2025" })
    );
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ pending: true });
  });

  it("200 ok and attaches metrics to the matching USER turn", async () => {
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockPrisma.mockTurn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId_clientTurnId: { sessionId: "s1", clientTurnId: "c1" } },
      })
    );
  });

  it("uses Deepgram verbatim and stores disfluency when configured", async () => {
    mockDeepgram.isDeepgramConfigured.mockReturnValue(true);
    mockDeepgram.transcribeVerbatim.mockResolvedValueOnce({
      transcript: "um I I think",
      words: [
        { text: "um", start: 0, end: 0.3, isFiller: true },
        { text: "I", start: 0.5, end: 0.7 },
        { text: "I", start: 0.8, end: 1.0 },
        { text: "think", start: 1.1, end: 1.5 },
      ],
      durationSec: 6.2,
    });
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(200);
    expect(mockDeepgram.transcribeVerbatim).toHaveBeenCalled();
    expect(mockOpenai.transcribeAudio).not.toHaveBeenCalled(); // no Whisper fallback
    const arg = mockPrisma.mockTurn.update.mock.calls[0]![0];
    expect(arg.data.disfluencyJson).toBeTruthy();
  });

  it("falls back to Whisper (no disfluency) when Deepgram errors", async () => {
    mockDeepgram.isDeepgramConfigured.mockReturnValue(true);
    mockDeepgram.transcribeVerbatim.mockRejectedValueOnce(new Error("deepgram down"));
    const res = await POST(audioReq({ clientTurnId: "c1", audio: wav() }), params("s1"));
    expect(res.status).toBe(200);
    expect(mockOpenai.transcribeAudio).toHaveBeenCalled(); // fell back
    const arg = mockPrisma.mockTurn.update.mock.calls[0]![0];
    expect(arg.data.disfluencyJson).toBeUndefined();
  });
});
