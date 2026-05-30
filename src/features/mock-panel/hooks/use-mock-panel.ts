"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RealtimeEphemeral, PanelSeatPublic, TurnEvents } from "@sevenlabs/shared-types";
import {
  panelReducer,
  initialPanelState,
  type PanelState,
  type RecoveryKind,
} from "../lib/panel-machine";
import { createTurnQueue, type TurnQueue } from "../lib/turn-queue";
import { connectRealtime, type RealtimePeer } from "../lib/realtime-connection";
import * as api from "../lib/mock-api";

const TTL_GUARD_MS = 20_000; // re-mint this long before the ephemeral expires
const CONFERRING_BEAT_MS = 500; // "panel is conferring" handoff beat
const MAX_RECONNECTS = 3;
const SPURIOUS_COACH_MIN_WORDS = 3;
const ICE_DISCONNECT_GRACE_MS = 4000; // ICE "disconnected" is flappy; let it self-heal
const MAX_POLL_ERRORS = 5; // bounded report-poll retries before giving up

/**
 * The full client orchestration: create -> per-seat connect/handoff -> wrap ->
 * debrief-poll -> report, with every recovery path. The pure state machine
 * lives in panel-machine.ts (unit-tested); this hook performs the side effects
 * on phase entry and dispatches the results back. (REALTIME_CLIENT_PLAN.md.)
 */
export function useMockPanel() {
  const [state, dispatch] = useReducer(panelReducer, undefined, initialPanelState);
  // Live transcript + streaming coach text are render-visible state (not refs).
  const [liveTranscript, setLiveTranscript] = useState<
    Array<{ role: "USER" | "COACH"; seatId: string | null; text: string }>
  >([]);
  const [coachStreaming, setCoachStreaming] = useState("");

  // Mirror state for stable callbacks (avoid stale closures in transport cbs).
  const stateRef = useRef<PanelState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const scenarioRef = useRef<string>("");
  const clientReqRef = useRef<string>("");
  const micStreamRef = useRef<MediaStream | null>(null);
  const micMeterStopRef = useRef<(() => void) | null>(null);
  const peerRef = useRef<RealtimePeer | null>(null);
  const queueRef = useRef<TurnQueue | null>(null);
  const ephemeralRef = useRef<RealtimeEphemeral | null>(null);
  const seatsRef = useRef<PanelSeatPublic[]>([]);

  const coachAccumRef = useRef<string>("");
  const turnsLogRef = useRef<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const lastCoachDoneAtRef = useRef<number>(0);
  const pendingBargeInsRef = useRef<number>(0);
  const pendingInterruptionsRef = useRef<number>(0);
  const replayOnConnectRef = useRef<boolean>(false);
  const micLevelRef = useRef<number>(0);
  const speakingRef = useRef<boolean>(false);
  const handledPhaseRef = useRef<string>("");
  const iceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSeatId = useCallback(
    () => seatsRef.current[stateRef.current.activeSeatIndex]?.id ?? null,
    []
  );

  // ── mic metering (drives the voice orb) ────────────────────────────────────
  const startMicMeter = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      micLevelRef.current = Math.min(1, Math.sqrt(sum / data.length) * 4);
      raf = requestAnimationFrame(tick);
    };
    tick();
    micMeterStopRef.current = () => {
      cancelAnimationFrame(raf);
      try {
        src.disconnect();
        void ctx.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stopMic = useCallback(() => {
    micMeterStopRef.current?.();
    micMeterStopRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, []);

  const closePeer = useCallback(() => {
    if (iceDebounceRef.current) {
      clearTimeout(iceDebounceRef.current);
      iceDebounceRef.current = null;
    }
    peerRef.current?.close();
    peerRef.current = null;
  }, []);

  // ── transport callbacks (read fresh state via stateRef) ─────────────────────
  const enqueueUser = useCallback((transcript: string) => {
    const events: TurnEvents = {};
    if (lastCoachDoneAtRef.current > 0) {
      events.latencyToAnswerMs = Math.max(0, Date.now() - lastCoachDoneAtRef.current);
    }
    if (pendingBargeInsRef.current > 0) events.bargeIns = pendingBargeInsRef.current;
    if (pendingInterruptionsRef.current > 0) events.interruptions = pendingInterruptionsRef.current;
    pendingBargeInsRef.current = 0;
    pendingInterruptionsRef.current = 0;
    const seatId = activeSeatId();
    queueRef.current?.enqueue({ role: "USER", transcript, seatId, words: [], events });
    turnsLogRef.current.push({ role: "user", text: transcript });
    setLiveTranscript((prev) => [...prev, { role: "USER", seatId, text: transcript }]);
    dispatch({ type: "USER_TURN" });
  }, [activeSeatId]);

  const finalizeCoach = useCallback((transcript: string) => {
    const text = transcript.trim();
    coachAccumRef.current = "";
    setCoachStreaming("");
    if (text.split(/\s+/).filter(Boolean).length < SPURIOUS_COACH_MIN_WORDS) {
      return; // spurious server-VAD response — do not commit / consume seq
    }
    const seatId = activeSeatId();
    queueRef.current?.enqueue({ role: "COACH", transcript: text, seatId, words: [] });
    turnsLogRef.current.push({ role: "assistant", text });
    setLiveTranscript((prev) => [...prev, { role: "COACH", seatId, text }]);
    dispatch({ type: "COACH_DONE", transcript: text });
  }, [activeSeatId]);

  const doConnect = useCallback(async () => {
    const ephemeral = ephemeralRef.current;
    const micStream = micStreamRef.current;
    if (!ephemeral || !micStream) return;
    closePeer(); // never leak a prior peer (handoff/re-mint/reconnect/start re-entry)
    try {
      const peer = await connectRealtime({
        ephemeral,
        micStream,
        callbacks: {
          onDataChannelOpen: () => {
            if (replayOnConnectRef.current) {
              replayOnConnectRef.current = false;
              for (const t of turnsLogRef.current) peerRef.current?.pushHistory(t.role, t.text);
            }
          },
          onSessionUpdated: () => {
            const s = stateRef.current;
            if (!s.reachedLive) {
              if (!s.sessionId) return;
              void api.patchEvent(s.sessionId, "live").then((r) => {
                if (r.kind === "ok") dispatch({ type: "PATCH_LIVE_OK" });
              });
            } else {
              dispatch({ type: "RESUMED_LIVE" });
            }
          },
          onUserTranscript: (t) => {
            if (t.trim()) enqueueUser(t);
          },
          onCoachTranscriptDelta: (d) => {
            coachAccumRef.current += d;
            setCoachStreaming(coachAccumRef.current);
          },
          onCoachTranscriptDone: (t) => finalizeCoach(t || coachAccumRef.current),
          onSpeechStarted: () => {
            speakingRef.current = true;
            if (stateRef.current.coachResponseInFlight) pendingBargeInsRef.current += 1;
            dispatch({ type: "SPEECH_STARTED" });
          },
          onSpeechStopped: () => {
            speakingRef.current = false;
          },
          onCoachResponseStart: () => dispatch({ type: "COACH_RESPONSE_START" }),
          onCoachResponseDone: (cancelled) => {
            lastCoachDoneAtRef.current = Date.now();
            if (cancelled) pendingInterruptionsRef.current += 1;
            dispatch({ type: "COACH_RESPONSE_DONE", cancelled });
          },
          onConnectionStateChange: (st) => {
            if (st === "connected" || st === "completed") {
              if (iceDebounceRef.current) {
                clearTimeout(iceDebounceRef.current);
                iceDebounceRef.current = null;
              }
            } else if (st === "failed") {
              if (iceDebounceRef.current) {
                clearTimeout(iceDebounceRef.current);
                iceDebounceRef.current = null;
              }
              dispatch({ type: "DISCONNECTED" });
            } else if (st === "disconnected" && !iceDebounceRef.current) {
              // "disconnected" is transient/flappy — only treat as a real drop
              // if it hasn't self-healed after a grace window.
              iceDebounceRef.current = setTimeout(() => {
                iceDebounceRef.current = null;
                const ice = peerRef.current?.pc.iceConnectionState;
                if (ice === "disconnected" || ice === "failed") {
                  dispatch({ type: "DISCONNECTED" });
                }
              }, ICE_DISCONNECT_GRACE_MS);
            }
          },
          onError: () => {
            // A server `error` event or data-channel fault that didn't flip ICE.
            if (stateRef.current.reachedLive) dispatch({ type: "DISCONNECTED" });
            else dispatch({ type: "CREATE_ERROR", message: "Connection error" });
          },
        },
      });
      peerRef.current = peer;
    } catch {
      dispatch({ type: "DISCONNECTED" });
    }
  }, [enqueueUser, finalizeCoach, closePeer]);

  // ── phase-entry side effects ────────────────────────────────────────────────
  const doCreate = useCallback(async () => {
    const r = await api.createSession(scenarioRef.current, clientReqRef.current);
    switch (r.kind) {
      case "ok":
        ephemeralRef.current = r.data.ephemeral;
        seatsRef.current = r.data.seats;
        queueRef.current = createTurnQueue({
          post: (body) => api.postTurn(r.data.sessionId, body),
          fetchMaxSeq: async () => {
            const s = await api.getStatus(r.data.sessionId);
            return s.kind === "ok" ? s.data.maxSeq : -1;
          },
          onSessionExpired: () => dispatch({ type: "SESSION_EXPIRED" }),
        });
        dispatch({
          type: "CREATE_OK",
          sessionId: r.data.sessionId,
          seats: r.data.seats,
          maxDurationSec: r.data.spend.maxDurationSec,
          ephemeralExpiresAt: r.data.ephemeral.expiresAt,
        });
        void doConnect();
        break;
      case "duplicate":
        dispatch({ type: "CREATE_DUPLICATE", sessionId: r.sessionId });
        {
          const st = await api.getStatus(r.sessionId);
          if (st.kind === "ok") dispatch({ type: "ADOPTED", status: st.data.status });
        }
        break;
      case "already-live":
        dispatch({ type: "CREATE_ALREADY_LIVE" });
        break;
      case "capacity":
        dispatch({ type: "CREATE_CAPACITY" });
        break;
      case "rate-limited":
        dispatch({ type: "CREATE_RATE_LIMITED" });
        break;
      case "voice-unavailable":
        dispatch({ type: "CREATE_VOICE_UNAVAILABLE" });
        break;
      default:
        dispatch({ type: "CREATE_ERROR", message: r.message });
    }
  }, [doConnect]);

  const doHandoff = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    await queueRef.current?.drainBeforeComplete();
    closePeer();
    await new Promise((res) => setTimeout(res, CONFERRING_BEAT_MS));
    const nextIndex = s.activeSeatIndex + 1;
    const r = await api.mint(s.sessionId, { seatIndex: nextIndex, reason: "seat_handoff" });
    if (r.kind === "ephemeral") {
      ephemeralRef.current = r.ephemeral;
      dispatch({ type: "MINT_OK", ephemeralExpiresAt: r.ephemeral.expiresAt });
      void doConnect();
    } else if (r.kind === "expired") {
      dispatch({ type: "MINT_EXPIRED" });
    } else if (r.kind === "voice-unavailable") {
      dispatch({ type: "MINT_VOICE_UNAVAILABLE" });
    } else if (r.kind === "rate-limited") {
      dispatch({ type: "MINT_RATE_LIMITED" });
    } else {
      dispatch({ type: "MINT_EXPIRED" }); // unknown — judge what exists
    }
  }, [closePeer, doConnect]);

  const doRemint = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    closePeer();
    const r = await api.mint(s.sessionId, { seatIndex: s.activeSeatIndex, reason: "ttl_expiry" });
    if (r.kind === "ephemeral") {
      ephemeralRef.current = r.ephemeral;
      replayOnConnectRef.current = true;
      dispatch({ type: "MINT_OK", ephemeralExpiresAt: r.ephemeral.expiresAt });
      void doConnect();
    } else if (r.kind === "expired") {
      dispatch({ type: "MINT_EXPIRED" });
    } else if (r.kind === "not-renewable") {
      dispatch({ type: "MINT_NOT_RENEWABLE", status: r.status });
    } else {
      dispatch({ type: "MINT_EXPIRED" });
    }
  }, [closePeer, doConnect]);

  const doReconnect = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    if (s.reconnectAttempts > MAX_RECONNECTS) {
      dispatch({ type: "RESUME_FAILED" });
      return;
    }
    closePeer();
    const patched = await api.patchEvent(s.sessionId, "interrupt");
    if (patched.kind !== "ok") {
      dispatch({ type: "RESUME_FAILED" });
      return;
    }
    const r = await api.mint(s.sessionId, {
      seatIndex: s.activeSeatIndex,
      reason: "resume_interrupted",
    });
    if (r.kind === "ephemeral") {
      ephemeralRef.current = r.ephemeral;
      replayOnConnectRef.current = true;
      dispatch({ type: "MINT_OK", ephemeralExpiresAt: r.ephemeral.expiresAt });
      void doConnect();
    } else if (r.kind === "not-renewable") {
      dispatch({ type: "MINT_NOT_RENEWABLE", status: r.status });
    } else if (r.kind === "expired") {
      dispatch({ type: "MINT_EXPIRED" });
    } else {
      dispatch({ type: "RESUME_FAILED" });
    }
  }, [closePeer, doConnect]);

  const doWrap = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    await queueRef.current?.drainBeforeComplete();
    closePeer();
    stopMic();
    const r = await api.complete(s.sessionId, s.hitCeiling ? "ceiling" : undefined);
    if (r.kind === "debrief") dispatch({ type: "COMPLETE_DEBRIEF" });
    else if (r.kind === "not-completable") dispatch({ type: "COMPLETE_NOT_COMPLETABLE" });
    else dispatch({ type: "COMPLETE_DEBRIEF" }); // already debriefing/completed — go poll
  }, [closePeer, stopMic]);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollErrorsRef = useRef<number>(0);
  const doPollRef = useRef<() => void>(() => {});
  const doPoll = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    const r = await api.getReport(s.sessionId, s.reportEtag);
    if (r.kind === "completed") {
      pollErrorsRef.current = 0;
      dispatch({ type: "REPORT_COMPLETED", report: r.report, etag: r.etag });
    } else if (r.kind === "failed") {
      dispatch({ type: "REPORT_FAILED", reason: r.reason });
    } else if (r.kind === "debrief") {
      pollErrorsRef.current = 0;
      pollTimerRef.current = setTimeout(() => doPollRef.current(), r.pollAfterMs);
    } else if (r.kind === "error") {
      // Transient fetch error: bounded retry so we never strand a blank report.
      pollErrorsRef.current += 1;
      if (pollErrorsRef.current >= MAX_POLL_ERRORS) {
        dispatch({ type: "REPORT_FAILED", reason: "judgment_timeout" });
      } else {
        pollTimerRef.current = setTimeout(() => doPollRef.current(), 2000);
      }
    }
    // not-modified: keep the report we already have
  }, []);
  useEffect(() => {
    doPollRef.current = () => void doPoll();
  }, [doPoll]);

  useEffect(() => {
    // Re-entry token: a repeated phase normally fires once, but each new
    // reconnect attempt (reconnectAttempts++ on a re-DISCONNECTED while already
    // reconnecting) must re-run doReconnect — else it hangs on the first try.
    const token =
      state.phase === "reconnecting"
        ? `reconnecting:${state.reconnectAttempts}`
        : state.phase;
    if (handledPhaseRef.current === token) return;
    handledPhaseRef.current = token;
    switch (state.phase) {
      case "creating":
        void doCreate();
        break;
      case "handing-off":
        void doHandoff();
        break;
      case "reminting":
        void doRemint();
        break;
      case "reconnecting":
        void doReconnect();
        break;
      case "wrapping":
        void doWrap();
        break;
      case "debrief-polling":
        void doPoll();
        break;
      case "report":
        if (!stateRef.current.report) void doPoll();
        break;
      default:
        break;
    }
  }, [state.phase, state.reconnectAttempts, doCreate, doHandoff, doRemint, doReconnect, doWrap, doPoll]);

  // ── TTL watchdog: re-mint near expiry, deferred to a turn boundary ──────────
  useEffect(() => {
    if (state.phase !== "live" || !state.ephemeralExpiresAt) return;
    const id = setInterval(() => {
      const exp = stateRef.current.ephemeralExpiresAt ?? 0;
      const idle = !speakingRef.current && !stateRef.current.coachResponseInFlight;
      if (Date.now() >= exp - TTL_GUARD_MS && idle) dispatch({ type: "TTL_REMINT" });
    }, 3000);
    return () => clearInterval(id);
  }, [state.phase, state.ephemeralExpiresAt]);

  // ── teardown ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (iceDebounceRef.current) clearTimeout(iceDebounceRef.current);
      peerRef.current?.close();
      micMeterStopRef.current?.();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── public actions ──────────────────────────────────────────────────────────
  const start = useCallback(
    async (scenarioId: string) => {
      // Reclaim everything from any prior run (retry / start-over enters here
      // with a peer, mic stream, AudioContext, and poll timer possibly alive).
      closePeer();
      stopMic();
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      scenarioRef.current = scenarioId;
      clientReqRef.current = crypto.randomUUID();
      turnsLogRef.current = [];
      coachAccumRef.current = "";
      lastCoachDoneAtRef.current = 0;
      pendingBargeInsRef.current = 0;
      pendingInterruptionsRef.current = 0;
      replayOnConnectRef.current = false;
      speakingRef.current = false;
      pollErrorsRef.current = 0;
      setLiveTranscript([]);
      setCoachStreaming("");
      dispatch({ type: "START" });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        startMicMeter(stream);
        dispatch({ type: "MIC_GRANTED" });
      } catch {
        dispatch({ type: "MIC_DENIED" });
      }
    },
    [startMicMeter, closePeer, stopMic]
  );

  const endAndScore = useCallback(() => dispatch({ type: "END_REQUESTED" }), []);
  const retryConnect = useCallback(() => {
    const s = stateRef.current;
    if (s.reachedLive && s.sessionId) dispatch({ type: "DISCONNECTED" });
    else void start(scenarioRef.current);
  }, [start]);
  const startOver = useCallback(() => void start(scenarioRef.current), [start]);
  const dismissError = useCallback(() => dispatch({ type: "DISMISS_ERROR" }), []);

  return {
    phase: state.phase,
    seats: state.seats,
    activeSeatIndex: state.activeSeatIndex,
    completedSeatIndexes: state.completedSeatIndexes,
    coachResponseInFlight: state.coachResponseInFlight,
    reachedLive: state.reachedLive,
    committedTurns: state.committedTurns,
    bargeIns: state.bargeIns,
    maxDurationSec: state.maxDurationSec,
    ephemeralExpiresAt: state.ephemeralExpiresAt,
    hitCeiling: state.hitCeiling,
    report: state.report,
    recovery: state.recovery as RecoveryKind | null,
    errorMessage: state.errorMessage,
    sessionId: state.sessionId,
    liveTranscript,
    coachStreaming,
    micLevelRef,
    start,
    endAndScore,
    retryConnect,
    startOver,
    dismissError,
  };
}
