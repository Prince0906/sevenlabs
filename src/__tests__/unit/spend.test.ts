import { describe, it, expect, vi } from "vitest";

// The spend meter reads env thresholds and imports prisma at module load. Pin the
// env to known values and stub prisma so the PURE meter math is deterministic.
vi.mock("@/lib/env", () => ({
  env: {
    SESSION_CEILING_USD: 4,
    MAX_SESSION_SEC: 2700,
    REALTIME_USD_PER_MIN: 0.3,
    DAILY_CAP_USD: 50,
  },
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  estimateSessionUsd,
  spendCentsForElapsed,
  isOverCeiling,
} from "@/lib/mock/spend";

// These three are the authoritative, server-clock cost meter + per-session
// kill-switch. A sign/rounding error silently over- or under-charges every
// session or disables the ceiling — so lock the math and both boundaries.
describe("spend meter (pure)", () => {
  describe("estimateSessionUsd", () => {
    it("caps the up-front hold at the session ceiling", () => {
      // (2700/60)*0.3 = 13.5, capped to the 4 ceiling.
      expect(estimateSessionUsd()).toBe(4);
    });
  });

  describe("spendCentsForElapsed", () => {
    it("is zero at the start", () => {
      expect(spendCentsForElapsed(0)).toBe(0);
    });
    it("charges $0.30/min = 30 cents at 60s", () => {
      expect(spendCentsForElapsed(60)).toBe(30);
    });
    it("scales linearly (600s → 300 cents)", () => {
      expect(spendCentsForElapsed(600)).toBe(300);
    });
    it("rounds to the nearest cent (not truncated)", () => {
      // (1/60)*0.3*100 = 0.5 → Math.round → 1 cent, not floored to 0.
      expect(spendCentsForElapsed(1)).toBe(1);
    });
  });

  describe("isOverCeiling", () => {
    it("is false well under both limits", () => {
      expect(isOverCeiling(100, 60)).toBe(false); // $1, 60s
    });
    it("trips at the dollar ceiling (>=, inclusive)", () => {
      expect(isOverCeiling(400, 60)).toBe(true); // $4 == ceiling
    });
    it("trips at MAX_SESSION_SEC even with trivial spend", () => {
      expect(isOverCeiling(0, 2700)).toBe(true);
    });
    it("is false just under both boundaries", () => {
      expect(isOverCeiling(399, 2699)).toBe(false); // $3.99, 2699s
    });
  });
});
