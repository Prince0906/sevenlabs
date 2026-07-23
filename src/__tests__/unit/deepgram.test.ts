import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable env mock so we can toggle the key between tests.
const mockEnv = vi.hoisted(() => ({
  env: { DEEPGRAM_API_KEY: "dg-test", OPENAI_API_KEY: "x" } as { DEEPGRAM_API_KEY?: string; OPENAI_API_KEY: string },
}));
vi.mock("@/lib/env", () => mockEnv);

import { transcribeVerbatim, isDeepgramConfigured } from "@/lib/providers/deepgram";

const okResponse = () => ({
  ok: true,
  json: async () => ({
    metadata: { duration: 6.2 },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: "um I I think",
              words: [
                { word: "um", start: 0, end: 0.3 },
                { word: "I", start: 0.5, end: 0.7 },
                { word: "I", start: 0.8, end: 1.0 },
                { word: "think", start: 1.1, end: 1.5 },
              ],
            },
          ],
        },
      ],
    },
  }),
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockEnv.env.DEEPGRAM_API_KEY = "dg-test";
});

describe("transcribeVerbatim (Deepgram adapter)", () => {
  it("maps words, flags fillers, and reads duration", async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse()) as never;
    const r = await transcribeVerbatim(Buffer.from("x"), "audio/webm");
    expect(r.transcript).toBe("um I I think");
    expect(r.durationSec).toBe(6.2);
    expect(r.words).toHaveLength(4);
    expect(r.words[0]).toMatchObject({ text: "um", isFiller: true });
    expect(r.words[1]).toMatchObject({ text: "I", isFiller: false });
  });

  it("requests verbatim mode with Token auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as never;
    await transcribeVerbatim(Buffer.from("x"), "audio/webm");
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("filler_words=true");
    expect(String(url)).toContain("language=en");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: "Token dg-test" });
  });

  it("throws on a non-ok response (no body leak)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    await expect(transcribeVerbatim(Buffer.from("x"), "audio/webm")).rejects.toThrow();
  });

  it("throws when no key is configured", async () => {
    mockEnv.env.DEEPGRAM_API_KEY = undefined;
    await expect(transcribeVerbatim(Buffer.from("x"), "audio/webm")).rejects.toThrow();
  });

  it("isDeepgramConfigured reflects the key presence", () => {
    expect(isDeepgramConfigured()).toBe(true);
    mockEnv.env.DEEPGRAM_API_KEY = undefined;
    expect(isDeepgramConfigured()).toBe(false);
  });
});
