import { describe, it, expect } from "vitest";
import {
  getCoachConfig,
  getRandomPrompt,
  buildCoachUserMessage,
  COACH_SYSTEM_PROMPT,
  OPENING_COACH_TEXT,
} from "../coach-prompt";

describe("getCoachConfig", () => {
  it("returns interview config for 'interview' mode", () => {
    const config = getCoachConfig("interview");
    expect(config.systemPrompt).toContain("interview");
    expect(config.openingText).toContain("interview");
    expect(config.practicePrompts.length).toBeGreaterThan(0);
    expect(config.userMessageSuffix).toContain("interview");
  });

  it("returns pitch config for 'pitch' mode", () => {
    const config = getCoachConfig("pitch");
    expect(config.systemPrompt).toContain("pitch");
    expect(config.openingText).toContain("pitch");
    expect(config.practicePrompts.length).toBeGreaterThan(0);
  });

  it("returns presentation config for 'presentation' mode", () => {
    const config = getCoachConfig("presentation");
    expect(config.systemPrompt).toContain("presentation");
    expect(config.openingText).toContain("presentation");
    expect(config.practicePrompts.length).toBeGreaterThan(0);
  });

  it("returns delivery config for 'delivery' mode", () => {
    const config = getCoachConfig("delivery");
    expect(config.systemPrompt).toContain("delivery");
    expect(config.practicePrompts).toHaveLength(0);
  });

  it("falls back to delivery for unknown modes", () => {
    const config = getCoachConfig("unknown-mode");
    const deliveryConfig = getCoachConfig("delivery");
    expect(config).toBe(deliveryConfig);
  });

  it("falls back to delivery for empty string", () => {
    const config = getCoachConfig("");
    const deliveryConfig = getCoachConfig("delivery");
    expect(config).toBe(deliveryConfig);
  });
});

describe("getRandomPrompt", () => {
  it("returns a string for modes with prompts", () => {
    const prompt = getRandomPrompt("interview");
    expect(typeof prompt).toBe("string");
    expect(prompt!.length).toBeGreaterThan(0);
  });

  it("returns null for delivery mode (no prompts)", () => {
    expect(getRandomPrompt("delivery")).toBeNull();
  });
});

describe("buildCoachUserMessage", () => {
  const metrics = {
    wpm: 140,
    pauseCount: 3,
    avgPauseMs: 500,
    longestPauseMs: 800,
    fillerCount: 2,
    speakingRatio: 0.85,
    turnDurationSec: 30,
  };

  it("includes mode-specific suffix for interview mode", () => {
    const msg = buildCoachUserMessage("Hello", metrics, 1, "interview");
    expect(msg).toContain("interview");
  });

  it("includes delivery suffix by default", () => {
    const msg = buildCoachUserMessage("Hello", metrics, 1);
    expect(msg).toContain("delivery only");
  });

  it("includes transcript and metrics", () => {
    const msg = buildCoachUserMessage("Test speech", metrics, 2, "pitch");
    expect(msg).toContain("Test speech");
    expect(msg).toContain("140");
    expect(msg).toContain("Turn 2");
  });
});

describe("backward compatibility", () => {
  it("COACH_SYSTEM_PROMPT matches delivery mode", () => {
    const config = getCoachConfig("delivery");
    expect(COACH_SYSTEM_PROMPT).toBe(config.systemPrompt);
  });

  it("OPENING_COACH_TEXT matches delivery mode", () => {
    const config = getCoachConfig("delivery");
    expect(OPENING_COACH_TEXT).toBe(config.openingText);
  });
});
