import type {
  CreateInterviewSessionResponse,
  StatusResponse,
  TurnResponse,
  InterviewReport,
  RealtimeEphemeral,
  InterviewStatusT,
  WordTimestamp,
  TurnEvents,
} from "@sevenlabs/shared-types";

/**
 * Typed bare-fetch wrappers for the 6 /api/interview routes. Each returns a result
 * DISCRIMINATED over both status code AND body shape, so the state machine can
 * branch without re-parsing. Matches the existing res.ok + res.json().catch
 * convention.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return res.json().catch(() => ({}) as Record<string, unknown>);
}
function errMsg(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === "string" ? body.error : fallback;
}

// ── POST /sessions (create) ─────────────────────────────────────────────────
export type CreateResult =
  | { kind: "ok"; data: CreateInterviewSessionResponse }
  | { kind: "duplicate"; sessionId: string }
  | { kind: "already-live" }
  | { kind: "capacity" }
  | { kind: "rate-limited" }
  | { kind: "voice-unavailable" }
  | { kind: "error"; status: number; message: string };

export async function createSession(
  scenarioId: string,
  clientRequestId: string
): Promise<CreateResult> {
  const res = await fetch("/api/interview/sessions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ scenarioId, clientRequestId }),
  });
  if (res.ok) {
    return { kind: "ok", data: (await res.json()) as CreateInterviewSessionResponse };
  }
  const body = await readJson(res);
  if (res.status === 409) {
    // Two distinct 409s: duplicate clientRequestId (carries sessionId) vs the
    // global single-LIVE cap (no sessionId — a fresh request can't help).
    if (typeof body.sessionId === "string") {
      return { kind: "duplicate", sessionId: body.sessionId };
    }
    return { kind: "already-live" };
  }
  if (res.status === 503) return { kind: "capacity" };
  if (res.status === 429) return { kind: "rate-limited" };
  if (res.status === 502) return { kind: "voice-unavailable" };
  // 402 KEY_REJECTED: the user's own key was rejected/exhausted at mint. It's now
  // condemned server-side (next session falls to trial); give a key-specific
  // message instead of a generic failure. (§3.5)
  if (res.status === 402) {
    return {
      kind: "error",
      status: 402,
      message:
        "Your OpenAI key was rejected or out of quota. Update it in Settings, or run in trial mode.",
    };
  }
  return { kind: "error", status: res.status, message: errMsg(body, "Failed to start") };
}

// ── GET /sessions/:id (rehydrate) ────────────────────────────────────────────
export type StatusResult =
  | { kind: "ok"; data: StatusResponse }
  | { kind: "error"; status: number; message: string };

export async function getStatus(id: string): Promise<StatusResult> {
  const res = await fetch(`/api/interview/sessions/${id}`);
  if (res.ok) return { kind: "ok", data: (await res.json()) as StatusResponse };
  return {
    kind: "error",
    status: res.status,
    message: errMsg(await readJson(res), "Status fetch failed"),
  };
}

// ── PATCH /sessions/:id (live | interrupt) ───────────────────────────────────
export type PatchResult =
  | { kind: "ok"; status: InterviewStatusT }
  | { kind: "error"; status: number; message: string };

export async function patchEvent(
  id: string,
  event: "live" | "interrupt"
): Promise<PatchResult> {
  const res = await fetch(`/api/interview/sessions/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ event }),
  });
  const body = await readJson(res);
  if (res.ok) return { kind: "ok", status: body.status as InterviewStatusT };
  return { kind: "error", status: res.status, message: errMsg(body, "Patch failed") };
}

// ── POST /sessions/:id/mint (initial / handoff / ttl / resume) ───────────────
export type MintResult =
  | { kind: "ephemeral"; ephemeral: RealtimeEphemeral }
  | { kind: "expired" }
  | { kind: "not-renewable"; status: InterviewStatusT }
  | { kind: "voice-unavailable" }
  | { kind: "rate-limited" }
  | { kind: "error"; status: number; message: string };

export async function mint(
  id: string,
  opts: { seatIndex?: number; reason?: "ttl_expiry" | "resume_interrupted" | "seat_handoff" }
): Promise<MintResult> {
  const res = await fetch(`/api/interview/sessions/${id}/mint`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ seatIndex: opts.seatIndex ?? 0, reason: opts.reason ?? "ttl_expiry" }),
  });
  if (res.ok) {
    const data = (await res.json()) as { ephemeral: RealtimeEphemeral };
    return { kind: "ephemeral", ephemeral: data.ephemeral };
  }
  const body = await readJson(res);
  if (res.status === 410) return { kind: "expired" };
  if (res.status === 409) return { kind: "not-renewable", status: body.status as InterviewStatusT };
  if (res.status === 502) return { kind: "voice-unavailable" };
  if (res.status === 429) return { kind: "rate-limited" };
  return { kind: "error", status: res.status, message: errMsg(body, "Mint failed") };
}

// ── POST /sessions/:id/turns (idempotent checkpoint) ─────────────────────────
export interface TurnPostBody {
  seq: number;
  role: "USER" | "INTERVIEWER";
  seatId?: string | null;
  transcript?: string;
  words?: WordTimestamp[];
  events?: TurnEvents;
  clientTurnId?: string;
}
export type TurnResult =
  | { kind: "ok"; data: TurnResponse }
  | { kind: "seq-conflict" }
  | { kind: "not-live" }
  | { kind: "error"; status: number; message: string };

export async function postTurn(id: string, body: TurnPostBody): Promise<TurnResult> {
  const res = await fetch(`/api/interview/sessions/${id}/turns`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  if (res.ok) return { kind: "ok", data: (await res.json()) as TurnResponse };
  const data = await readJson(res);
  if (res.status === 409) {
    return data.error === "SEQ_CONFLICT" ? { kind: "seq-conflict" } : { kind: "not-live" };
  }
  return { kind: "error", status: res.status, message: errMsg(data, "Turn post failed") };
}

// ── POST /sessions/:id/turns/audio (best-effort fluency analysis) ────────────
// Uploads ONE push-to-talk answer's audio for Whisper word-timing analysis. Fire-
// and-forget from the hook; never blocks the interview. 202 means the matching
// text turn row isn't written yet (the upload raced ahead) — retry a few times.
export async function uploadTurnAudio(
  id: string,
  clientTurnId: string,
  blob: Blob
): Promise<void> {
  const form = new FormData();
  form.append("clientTurnId", clientTurnId);
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, `answer.${ext}`);
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(`/api/interview/sessions/${id}/turns/audio`, {
        method: "POST",
        body: form,
      });
    } catch {
      return; // network error — best-effort, drop this answer's fluency
    }
    if (res.status !== 202) return; // 200 ok or a 4xx/5xx we won't retry past
    await new Promise((r) => setTimeout(r, 1500)); // text turn not written yet
  }
}

// ── POST /sessions/:id/complete ──────────────────────────────────────────────
export type CompleteResult =
  | { kind: "debrief"; pollAfterMs: number }
  | { kind: "not-completable" }
  | { kind: "error"; status: number; message: string };

export async function complete(
  id: string,
  opts?: { reason?: string; degradedDelivery?: boolean }
): Promise<CompleteResult> {
  const res = await fetch(`/api/interview/sessions/${id}/complete`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      ...(opts?.reason ? { reason: opts.reason } : {}),
      ...(opts?.degradedDelivery ? { degradedDelivery: true } : {}),
    }),
  });
  const body = await readJson(res);
  if (res.status === 202) {
    return { kind: "debrief", pollAfterMs: typeof body.pollAfterMs === "number" ? body.pollAfterMs : 2000 };
  }
  if (res.status === 409) return { kind: "not-completable" };
  return { kind: "error", status: res.status, message: errMsg(body, "Complete failed") };
}

// ── GET /sessions/:id/report (poll) ──────────────────────────────────────────
export type ReportResult =
  | { kind: "completed"; report: InterviewReport; etag: string | null }
  | { kind: "debrief"; pollAfterMs: number }
  | { kind: "failed"; reason?: string }
  | { kind: "not-modified" }
  | { kind: "error"; status: number; message: string };

// ── /sessions/:id/outcome (D13 moat capture) ─────────────────────────────────
// The real hire/no-hire label — the one signal a model can't manufacture. Captured
// candidate-side when they return, kept off the credential. Includes the unresolved
// states (GHOSTED / PENDING) so we don't only ever record the wins and losses.
export type OutcomeResult = "ADVANCED" | "OFFER" | "REJECTED" | "GHOSTED" | "PENDING";

export interface CapturedOutcome {
  sessionId: string;
  result: OutcomeResult;
  predictedSignal: string | null;
  predictedWeakest: string | null;
  capturedAt: string;
}

export async function getOutcome(
  id: string
): Promise<{ outcome: CapturedOutcome | null; company: string | null }> {
  const res = await fetch(`/api/interview/sessions/${id}/outcome`);
  if (!res.ok) return { outcome: null, company: null };
  const body = await readJson(res);
  return {
    outcome: (body.outcome as CapturedOutcome | null) ?? null,
    company: typeof body.company === "string" ? body.company : null,
  };
}

export async function submitOutcome(id: string, result: OutcomeResult): Promise<boolean> {
  const res = await fetch(`/api/interview/sessions/${id}/outcome`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ result }),
  });
  return res.ok;
}

export async function getReport(id: string, etag?: string | null): Promise<ReportResult> {
  const res = await fetch(`/api/interview/sessions/${id}/report`, {
    // If-None-Match must echo the server's ETag byte-for-byte (quotes included).
    headers: etag ? { "If-None-Match": etag } : undefined,
  });
  if (res.status === 304) return { kind: "not-modified" };
  const body = await readJson(res);
  if (res.status === 202) {
    return { kind: "debrief", pollAfterMs: typeof body.pollAfterMs === "number" ? body.pollAfterMs : 2000 };
  }
  if (res.ok) {
    if (body.status === "COMPLETED") {
      return { kind: "completed", report: body.report as InterviewReport, etag: res.headers.get("etag") };
    }
    if (body.status === "FAILED") {
      return { kind: "failed", reason: typeof body.reason === "string" ? body.reason : undefined };
    }
    // Non-terminal status at 200 (PENDING/LIVE) — unexpected during polling.
    return { kind: "error", status: 200, message: String(body.status ?? "unexpected") };
  }
  return { kind: "error", status: res.status, message: errMsg(body, "Report fetch failed") };
}
