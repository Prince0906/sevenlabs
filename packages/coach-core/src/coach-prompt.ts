import type { SpeechMetrics } from "@sevenlabs/shared-types";

export type CoachingMode = "interview" | "pitch" | "presentation" | "delivery";

export interface CoachConfig {
  systemPrompt: string;
  openingText: string;
  practicePrompts: string[];
  userMessageSuffix: string;
}

const COACHING_CONFIGS: Record<CoachingMode, CoachConfig> = {
  interview: {
    systemPrompt: `You are a concise interview speaking coach. Focus on delivery: pace, pauses, filler words, and confidence. Note if the speaker uses the STAR method structure but do NOT rewrite their answer. Give exactly 2 short sentences: one delivery observation, one actionable tip. Be encouraging and specific. Never exceed 50 words.`,
    openingText:
      "Let's practice interview answers. I'll coach your delivery after each response — focus on speaking clearly and confidently.",
    practicePrompts: [
      "Tell me about a time you led a team through a difficult challenge.",
      "Why are you interested in this role?",
      "Describe a project you're most proud of.",
      "Tell me about a time you had to deal with a conflict at work.",
      "Where do you see yourself in five years?",
      "Walk me through a technical decision you made recently.",
    ],
    userMessageSuffix:
      "Coach the speaker on interview delivery — confidence, structure, and clarity.",
  },
  pitch: {
    systemPrompt: `You are a concise pitch delivery coach. Focus on clarity, timing, energy, and eliminating filler words. The pitch should feel confident and well-paced. Give exactly 2 short sentences: one observation, one tip. Be encouraging and specific. Never exceed 50 words.`,
    openingText:
      "Let's sharpen your pitch. Deliver it naturally, and I'll coach your timing, clarity, and energy.",
    practicePrompts: [
      "Pitch your product in 60 seconds.",
      "Explain what your company does to a non-technical person.",
      "Deliver your elevator pitch as if you're meeting an investor.",
    ],
    userMessageSuffix:
      "Coach the speaker on pitch delivery — clarity, energy, and timing.",
  },
  presentation: {
    systemPrompt: `You are a concise presentation delivery coach. Focus on pacing, pauses for emphasis, filler words, and audience engagement through vocal variety. Give exactly 2 short sentences: one observation, one tip. Be encouraging and specific. Never exceed 50 words.`,
    openingText:
      "Let's work on your presentation delivery. Speak a section of your talk, and I'll coach your pacing and vocal presence.",
    practicePrompts: [
      "Present the opening of your talk — set the stage for your audience.",
      "Explain a complex concept from your presentation simply.",
      "Deliver the closing of your presentation with conviction.",
    ],
    userMessageSuffix:
      "Coach the speaker on presentation delivery — pacing, emphasis, and vocal variety.",
  },
  delivery: {
    systemPrompt: `You are a concise interview speaking coach focused ONLY on delivery: pace, pauses, fillers, and turn-taking.\nDo NOT critique grammar, STAR structure, or answer content.\nGive exactly 2 short sentences: one observation about delivery, one actionable tip for the next turn.\nBe encouraging and specific. Never exceed 50 words total.`,
    openingText:
      "Welcome to practice mode. When you see your turn, speak your answer clearly. I'll coach your pace, pauses, and fillers after each turn.",
    practicePrompts: [],
    userMessageSuffix: "Coach the speaker on delivery only.",
  },
};

export function getCoachConfig(mode: string): CoachConfig {
  if (mode in COACHING_CONFIGS) {
    return COACHING_CONFIGS[mode as CoachingMode];
  }
  return COACHING_CONFIGS.delivery;
}

export function getRandomPrompt(mode: string): string | null {
  const config = getCoachConfig(mode);
  if (config.practicePrompts.length === 0) return null;
  return config.practicePrompts[
    Math.floor(Math.random() * config.practicePrompts.length)
  ];
}

export const COACH_SYSTEM_PROMPT = COACHING_CONFIGS.delivery.systemPrompt;
export const OPENING_COACH_TEXT = COACHING_CONFIGS.delivery.openingText;

export function buildCoachUserMessage(
  transcript: string,
  metrics: SpeechMetrics,
  turnNumber: number,
  mode: string = "delivery"
): string {
  const config = getCoachConfig(mode);
  return `Turn ${turnNumber} transcript:
"${transcript}"

Delivery metrics:
- Words per minute: ${metrics.wpm}
- Pauses (>${0.4}s): ${metrics.pauseCount}, avg ${metrics.avgPauseMs}ms, longest ${metrics.longestPauseMs}ms
- Filler words: ${metrics.fillerCount}
- Speaking ratio: ${Math.round(metrics.speakingRatio * 100)}%
- Turn duration: ${metrics.turnDurationSec}s

${config.userMessageSuffix}`;
}
