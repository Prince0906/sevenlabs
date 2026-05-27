import { describe, it, expect } from "vitest";
import { analyzeSpeech } from "../speech-analysis.js";
import { fixtureWordsDense, fixtureWordsWithPauses } from "./fixtures/words.js";

describe("analyzeSpeech", () => {
  it("computes WPM and low pauses for dense speech", () => {
    const metrics = analyzeSpeech({
      words: fixtureWordsDense,
      turnDurationSec: 8,
    });

    expect(metrics.wpm).toBeGreaterThan(100);
    expect(metrics.pauseCount).toBe(0);
    expect(metrics.fillerCount).toBe(0);
    expect(metrics.turnDurationSec).toBe(8);
  });

  it("detects pauses and fillers", () => {
    const metrics = analyzeSpeech({
      words: fixtureWordsWithPauses,
      turnDurationSec: 15,
    });

    expect(metrics.pauseCount).toBeGreaterThanOrEqual(1);
    expect(metrics.longestPauseMs).toBeGreaterThanOrEqual(400);
    expect(metrics.fillerCount).toBeGreaterThanOrEqual(1);
    expect(metrics.speakingRatio).toBeLessThan(1);
  });

  it("returns zeros for empty input", () => {
    const metrics = analyzeSpeech({ words: [], turnDurationSec: 5 });
    expect(metrics.wpm).toBe(0);
    expect(metrics.pauseCount).toBe(0);
  });
});
