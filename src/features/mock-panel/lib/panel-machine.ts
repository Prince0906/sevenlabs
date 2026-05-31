import type { PanelSeatPublic, MockReport, MockStatusT } from "@sevenlabs/shared-types";

/**
 * Pure state machine for the live panel. No React, no I/O — the hook performs
 * side effects (mint/connect/post/timers) on phase transitions and dispatches
 * the result back as an action. Keeping it pure makes every transition +
 * recovery path unit-testable. (REALTIME_CLIENT_PLAN.md step 9.)
 */
export type PanelPhase =
  | "idle"
  | "acquiring-mic"
  | "creating"
  | "connecting"
  | "awaiting-session-update"
  | "live"
  | "handing-off"
  | "reminting"
  | "reconnecting"
  | "wrapping"
  | "debrief-polling"
  | "report"
  | "error";

export type RecoveryKind =
  | "mic-denied"
  | "already-live"
  | "capacity"
  | "rate-limited"
  | "voice-unavailable"
  | "disconnected"
  | "not-startable"
  | "judgment-timeout"
  | "session-failed";

export interface PanelState {
  phase: PanelPhase;
  sessionId: string | null;
  seats: PanelSeatPublic[];
  activeSeatIndex: number;
  completedSeatIndexes: number[];
  reachedLive: boolean;
  exchangeCount: number; // USER turns with the active seat (handoff budget)
  bargeIns: number;
  interruptions: number;
  coachResponseInFlight: boolean;
  committedTurns: number;
  maxDurationSec: number;
  ephemeralExpiresAt: number | null;
  hitCeiling: boolean;
  report: MockReport | null;
  reportEtag: string | null;
  recovery: RecoveryKind | null;
  errorMessage: string | null;
  reconnectAttempts: number;
}

export type PanelAction =
  | { type: "START" }
  | { type: "MIC_GRANTED" }
  | { type: "MIC_DENIED" }
  | { type: "CREATE_OK"; sessionId: string; seats: PanelSeatPublic[]; maxDurationSec: number; ephemeralExpiresAt: number }
  | { type: "CREATE_DUPLICATE"; sessionId: string }
  | { type: "CREATE_ALREADY_LIVE" }
  | { type: "CREATE_CAPACITY" }
  | { type: "CREATE_RATE_LIMITED" }
  | { type: "CREATE_VOICE_UNAVAILABLE" }
  | { type: "CREATE_ERROR"; message: string }
  | { type: "ADOPTED"; status: MockStatusT }
  | { type: "DC_OPEN" }
  | { type: "PATCH_LIVE_OK" }
  | { type: "RESUMED_LIVE" }
  | { type: "USER_TURN" }
  | { type: "COACH_DONE"; transcript: string }
  | { type: "COACH_RESPONSE_START" }
  | { type: "COACH_RESPONSE_DONE"; cancelled: boolean }
  | { type: "SPEECH_STARTED" }
  | { type: "TTL_REMINT" }
  | { type: "MINT_OK"; ephemeralExpiresAt: number }
  | { type: "MINT_EXPIRED" }
  | { type: "MINT_NOT_RENEWABLE"; status: MockStatusT }
  | { type: "MINT_VOICE_UNAVAILABLE" }
  | { type: "MINT_RATE_LIMITED" }
  | { type: "DISCONNECTED" }
  | { type: "RESUME_FAILED" }
  | { type: "SESSION_EXPIRED" }
  | { type: "END_REQUESTED" }
  | { type: "COMPLETE_DEBRIEF" }
  | { type: "COMPLETE_NOT_COMPLETABLE" }
  | { type: "REPORT_COMPLETED"; report: MockReport; etag: string | null }
  | { type: "REPORT_FAILED"; reason?: string }
  | { type: "DISMISS_ERROR" };

export const HANDOFF_SENTINEL = "handing you to my colleague";

/** Safety cap when the persona's closing sentinel isn't detected. */
export function seatBudget(isLast: boolean): number {
  return isLast ? 4 : 3;
}

export function detectsSentinel(transcript: string): boolean {
  return transcript.toLowerCase().includes(HANDOFF_SENTINEL);
}

export function initialPanelState(): PanelState {
  return {
    phase: "idle",
    sessionId: null,
    seats: [],
    activeSeatIndex: 0,
    completedSeatIndexes: [],
    reachedLive: false,
    exchangeCount: 0,
    bargeIns: 0,
    interruptions: 0,
    coachResponseInFlight: false,
    committedTurns: 0,
    maxDurationSec: 0,
    ephemeralExpiresAt: null,
    hitCeiling: false,
    report: null,
    reportEtag: null,
    recovery: null,
    errorMessage: null,
    reconnectAttempts: 0,
  };
}

function toError(
  state: PanelState,
  recovery: RecoveryKind,
  message: string | null = null
): PanelState {
  return { ...state, phase: "error", recovery, errorMessage: message };
}

/** Reconcile a server-reported status into a phase (after adopt / not-renewable). */
function reconcileStatus(state: PanelState, status: MockStatusT): PanelState {
  switch (status) {
    case "LIVE":
    case "INTERRUPTED":
      return { ...state, reachedLive: true, phase: "reconnecting" };
    case "DEBRIEF":
      return { ...state, reachedLive: true, phase: "debrief-polling" };
    case "COMPLETED":
      return { ...state, reachedLive: true, phase: "report" };
    default: // PENDING / FAILED / ABANDONED — nothing recoverable to connect to
      return toError(state, "not-startable");
  }
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "START":
      return { ...initialPanelState(), phase: "acquiring-mic" };
    case "MIC_GRANTED":
      return { ...state, phase: "creating" };
    case "MIC_DENIED":
      return toError(state, "mic-denied");

    case "CREATE_OK":
      return {
        ...state,
        sessionId: action.sessionId,
        seats: action.seats,
        maxDurationSec: action.maxDurationSec,
        ephemeralExpiresAt: action.ephemeralExpiresAt,
        activeSeatIndex: 0,
        phase: "connecting",
      };
    case "CREATE_DUPLICATE":
      // Adopt the existing session id (NEVER navigate to undefined); the hook
      // then GET /status and dispatches ADOPTED to reconcile.
      return { ...state, sessionId: action.sessionId };
    case "CREATE_ALREADY_LIVE":
      // Global single-LIVE cap: a fresh request can't help — surface, no nav.
      return toError(state, "already-live");
    case "CREATE_CAPACITY":
      return toError(state, "capacity");
    case "CREATE_RATE_LIMITED":
      return toError(state, "rate-limited");
    case "CREATE_VOICE_UNAVAILABLE":
      return toError(state, "voice-unavailable");
    case "CREATE_ERROR":
      return toError(state, "session-failed", action.message);

    case "ADOPTED":
      return reconcileStatus(state, action.status);

    case "DC_OPEN":
      return { ...state, phase: "awaiting-session-update" };
    case "PATCH_LIVE_OK":
      return { ...state, reachedLive: true, phase: "live" };
    case "RESUMED_LIVE":
      return { ...state, phase: "live", reconnectAttempts: 0 };

    case "USER_TURN":
      if (state.phase !== "live") return state;
      return { ...state, exchangeCount: state.exchangeCount + 1, committedTurns: state.committedTurns + 1 };

    case "COACH_RESPONSE_START":
      return { ...state, coachResponseInFlight: true };
    case "COACH_RESPONSE_DONE":
      return {
        ...state,
        coachResponseInFlight: false,
        interruptions: action.cancelled ? state.interruptions + 1 : state.interruptions,
      };
    case "SPEECH_STARTED":
      // Barge-in = cutting over the coach while a response is in flight.
      return state.coachResponseInFlight ? { ...state, bargeIns: state.bargeIns + 1 } : state;

    case "COACH_DONE": {
      if (state.phase !== "live") return { ...state, committedTurns: state.committedTurns + 1 };
      const isLast = state.activeSeatIndex >= state.seats.length - 1;
      const handoff =
        detectsSentinel(action.transcript) || state.exchangeCount >= seatBudget(isLast);
      const committed = { ...state, committedTurns: state.committedTurns + 1 };
      if (!handoff) return committed;
      return { ...committed, phase: isLast ? "wrapping" : "handing-off" };
    }

    case "TTL_REMINT":
      // Watchdog fired at a turn boundary: re-mint the SAME seat.
      if (state.phase !== "live") return state;
      return { ...state, phase: "reminting" };

    case "MINT_OK":
      if (state.phase === "handing-off") {
        // Advance to the next seat (new voice/persona).
        return {
          ...state,
          completedSeatIndexes: [...state.completedSeatIndexes, state.activeSeatIndex],
          activeSeatIndex: state.activeSeatIndex + 1,
          exchangeCount: 0,
          ephemeralExpiresAt: action.ephemeralExpiresAt,
          phase: "connecting",
        };
      }
      // reminting / reconnecting: same seat, fresh ephemeral.
      return { ...state, ephemeralExpiresAt: action.ephemeralExpiresAt, phase: "connecting" };
    case "MINT_EXPIRED":
      // Ceiling crossed at a handoff/TTL boundary — judge what exists.
      return { ...state, phase: "wrapping", hitCeiling: true };
    case "MINT_NOT_RENEWABLE":
      return reconcileStatus(state, action.status);
    case "MINT_VOICE_UNAVAILABLE":
      return toError(state, "voice-unavailable");
    case "MINT_RATE_LIMITED":
      return toError(state, "rate-limited");

    case "DISCONNECTED":
      if (!state.reachedLive) return toError(state, "not-startable");
      return { ...state, phase: "reconnecting", reconnectAttempts: state.reconnectAttempts + 1 };
    case "RESUME_FAILED":
      return toError(state, "disconnected");

    case "SESSION_EXPIRED":
      return { ...state, phase: "wrapping", hitCeiling: true };
    case "END_REQUESTED":
      return { ...state, phase: "wrapping" };
    case "COMPLETE_DEBRIEF":
      return { ...state, phase: "debrief-polling" };
    case "COMPLETE_NOT_COMPLETABLE":
      return toError(state, "not-startable");

    case "REPORT_COMPLETED":
      return { ...state, phase: "report", report: action.report, reportEtag: action.etag };
    case "REPORT_FAILED":
      return toError(
        state,
        action.reason === "judgment_timeout" ? "judgment-timeout" : "session-failed"
      );

    case "DISMISS_ERROR":
      return { ...state, recovery: null, errorMessage: null };

    default:
      return state;
  }
}
