import { describe, it, expect } from "vitest";
import { turnCostUsd, REALTIME_PRICES, type RealtimeUsage } from "../realtime-cost";

describe("turnCostUsd", () => {
  it("is 0 for null / empty usage", () => {
    expect(turnCostUsd(null)).toBe(0);
    expect(turnCostUsd(undefined)).toBe(0);
    expect(turnCostUsd({})).toBe(0);
  });

  it("sums the detailed breakdown at the right per-type rates", () => {
    const usage: RealtimeUsage = {
      input_token_details: { audio_tokens: 1_000_000, text_tokens: 1_000_000 },
      output_token_details: { audio_tokens: 1_000_000, text_tokens: 1_000_000 },
    };
    // 1M of each: 32 + 4 + 64 + 16 = 116
    expect(turnCostUsd(usage)).toBeCloseTo(116, 5);
  });

  it("applies the cache discount to cached input tokens", () => {
    const cached: RealtimeUsage = {
      input_token_details: {
        audio_tokens: 1_000_000,
        cached_tokens_details: { audio_tokens: 1_000_000 },
      },
    };
    // all audio input cached → $0.40, not $32
    expect(turnCostUsd(cached)).toBeCloseTo(REALTIME_PRICES.audioInputCached * 1_000_000, 6);

    const half: RealtimeUsage = {
      input_token_details: {
        audio_tokens: 1_000_000,
        cached_tokens_details: { audio_tokens: 400_000 },
      },
    };
    // 600k uncached * 32/1M + 400k cached * 0.40/1M
    expect(turnCostUsd(half)).toBeCloseTo(600_000 * REALTIME_PRICES.audioInput + 400_000 * REALTIME_PRICES.audioInputCached, 6);
  });

  it("falls back to coarse totals when there's no breakdown", () => {
    const usage: RealtimeUsage = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
    expect(turnCostUsd(usage)).toBeCloseTo(REALTIME_PRICES.audioInput * 1e6 + REALTIME_PRICES.audioOutput * 1e6, 5);
  });

  it("accumulates across turns to a realistic per-minute order of magnitude", () => {
    // ~1 min: 600 user-audio-in tokens, 1200 assistant-audio-out tokens, modest text
    const minute: RealtimeUsage = {
      input_token_details: { audio_tokens: 600, text_tokens: 200 },
      output_token_details: { audio_tokens: 1200, text_tokens: 100 },
    };
    const total = [minute, minute, minute].reduce((s, u) => s + turnCostUsd(u), 0);
    // sanity: a few cents to low tens of cents for ~3 min, not dollars or zero
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(1);
  });
});
