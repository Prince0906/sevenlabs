import type { SpeechMetrics } from "@sevenlabs/shared-types";

export const COACH_SYSTEM_PROMPT = `You are a concise interview speaking coach focused ONLY on delivery: pace, pauses, fillers, and turn-taking.
Do NOT critique grammar, STAR structure, or answer content.
Give exactly 2 short sentences: one observation about delivery, one actionable tip for the next turn.
Be encouraging and specific. Never exceed 50 words total.`;

export function buildCoachUserMessage(
  transcript: string,
  metrics: SpeechMetrics,
  turnNumber: number
): string {
  return `Turn ${turnNumber} transcript:
"${transcript}"

Delivery metrics:
- Words per minute: ${metrics.wpm}
- Pauses (>${0.4}s): ${metrics.pauseCount}, avg ${metrics.avgPauseMs}ms, longest ${metrics.longestPauseMs}ms
- Filler words: ${metrics.fillerCount}
- Speaking ratio: ${Math.round(metrics.speakingRatio * 100)}%
- Turn duration: ${metrics.turnDurationSec}s

Coach the speaker on delivery only.`;
}

export const OPENING_COACH_TEXT =
  "Welcome to practice mode. When you see your turn, speak your answer clearly. I'll coach your pace, pauses, and fillers after each turn.";
