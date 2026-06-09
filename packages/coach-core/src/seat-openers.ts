/**
 * Question VARIETY for the live panel.
 *
 * Panel questions are generated live by the realtime model from each seat's
 * persona — which means, left alone, the model gravitates to the same "greatest
 * hits" (closures, useMemo, keys) every session. This steers each seat to OPEN on
 * a different sub-topic per session, so the interview is replayable and doesn't
 * feel canned, while the persona still drives the follow-ups.
 *
 * The pick is DETERMINISTIC on (sessionId, seatOrder): a session always gets the
 * same opener (so a TTL re-mint / resume mid-interview re-derives it and doesn't
 * switch topics), but different sessions vary. The Bar Raiser seat has no pool —
 * it adapts to the candidate's strongest area, so its variety is the candidate.
 */

export interface SeatOpener {
  topic: string;
  prompt: string;
}

// Indexed by seatOrder. [2] = null: the Bar Raiser opens on the candidate's
// strongest area, not a fixed pool.
const REACT_JS_SEAT_OPENERS: (SeatOpener[] | null)[] = [
  // Seat 0 — JavaScript fundamentals
  [
    { topic: "closures", prompt: "What does a closure actually capture — and when does that bite you in practice?" },
    { topic: "the event loop", prompt: "Walk me through what happens, step by step, when a promise resolves inside a setTimeout — what runs first, and why?" },
    { topic: "`this` and binding", prompt: "How does `this` get its value in a regular function versus an arrow function, and why does that difference exist?" },
    { topic: "prototypes", prompt: "When you call a method on an object, how does JavaScript actually find it? What is the lookup doing?" },
    { topic: "types and coercion", prompt: "What's really happening under the hood with `==` versus `===`, and when would the coercion surprise you?" },
  ],
  // Seat 1 — React internals
  [
    { topic: "the re-render model", prompt: "When state changes, what does React actually do — re-run your component, re-create the DOM, or something else?" },
    { topic: "the rules of hooks", prompt: "Why must hooks be called in the same order every render? What is React tracking that makes that a hard rule?" },
    { topic: "reconciliation and keys", prompt: "What does React do when you insert an item in the middle of a keyed list — and what breaks if the key is the array index?" },
    { topic: "effects as synchronization", prompt: "What is useEffect actually synchronizing, and how do you reason about when it should re-run?" },
    { topic: "state batching", prompt: "If you call setState twice in one event handler, how many re-renders happen — and what changes if those calls are inside a setTimeout?" },
  ],
  null,
];

const POOLS: Record<string, (SeatOpener[] | null)[]> = {
  react: REACT_JS_SEAT_OPENERS,
};

// Dependency-free FNV-1a-style string hash. NOT Math.random, so the same session
// always derives the same opener (stable across a seat's re-mints).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministically pick this seat's opening sub-topic for this session.
 * Returns null when the seat/company has no pool (e.g. the Bar Raiser). */
export function pickSeatOpener(
  company: string,
  seatOrder: number,
  sessionId: string
): SeatOpener | null {
  const pool = POOLS[company]?.[seatOrder];
  if (!pool || pool.length === 0) return null;
  return pool[hash(`${sessionId}:${seatOrder}`) % pool.length] ?? null;
}

/** Instruction appended to the persona so it opens on the chosen sub-topic.
 * Phrased defensively ("if you have NOT yet asked…") so a mid-interview re-mint,
 * which replays history, treats it as a no-op instead of restarting the seat. */
export function openerInstruction(opener: SeatOpener): string {
  return `For this interview, if you have NOT yet asked your opening question, make your first question about ${opener.topic} — ask it in your own words, for example: "${opener.prompt}" Then follow the candidate's answers naturally; do not read from a script.`;
}
