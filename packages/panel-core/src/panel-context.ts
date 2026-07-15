/**
 * Cross-segment continuity for the live panel (INTERVIEW_ENGINE_PLAN §14.2).
 *
 * Each panel seat is a fresh realtime session (the handoff tears down the peer
 * and mints a new ephemeral), so by default a later interviewer has NO memory of
 * what the candidate told the earlier ones — the interview fragments into
 * disconnected mini-rounds. This builds a BOUNDED digest of the recent
 * conversation, injected into the next seat's instructions at mint time, so the
 * incoming interviewer can reference the arc while still introducing themselves
 * and owning their own area.
 *
 * Bounded by construction (last N turns, each truncated) so it can never grow
 * into the whole-transcript re-bill that unbounded replay would cause on a long
 * interview. Pure, no I/O — the mint route reads the turns from Postgres.
 */

export interface PanelTurnLite {
  role: "USER" | "INTERVIEWER";
  text: string | null;
}

// Enough for the incoming interviewer to feel continuity without re-billing the
// whole interview as context. ~3 exchanges.
const MAX_CONTEXT_TURNS = 6;
const MAX_TURN_CHARS = 320;

function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > MAX_TURN_CHARS ? `${t.slice(0, MAX_TURN_CHARS)}…` : t;
}

/**
 * Render the most recent committed turns into a continuity block for the next
 * seat. `turns` are oldest→newest; only the last MAX_CONTEXT_TURNS are used.
 * Returns "" when there's nothing yet (seat 1, or an empty handoff), so callers
 * can concatenate unconditionally.
 */
export function buildPanelContextDigest(turns: PanelTurnLite[]): string {
  const recent = turns
    .filter((t) => (t.text ?? "").trim().length > 0)
    .slice(-MAX_CONTEXT_TURNS)
    .map((t) => `${t.role === "USER" ? "Candidate" : "Interviewer"}: ${clip(t.text!)}`);

  if (recent.length === 0) return "";

  return [
    `EARLIER IN THIS PANEL — the candidate has already spoken with other interviewers on the panel. Use this only for continuity: you may briefly acknowledge what they covered, and do not repeat a question they were already asked. Still introduce yourself and drive your own area.`,
    `Recent exchange:`,
    ...recent,
  ].join("\n");
}
