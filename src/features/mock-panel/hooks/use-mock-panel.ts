"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { RealtimeEphemeral, PanelSeatPublic, TurnEvents } from "@sevenlabs/shared-types";
import {
  panelReducer,
  initialPanelState,
  detectsSentinel,
  type PanelState,
  type RecoveryKind,
} from "../lib/panel-machine";
import { createTurnQueue, type TurnQueue } from "../lib/turn-queue";
import { connectRealtime, type RealtimePeer } from "../lib/realtime-connection";
import {
  interviewerTurnNeedsContinuation,
  CONTINUATION_NUDGE,
  turnCostUsd,
  type RealtimeUsage,
} from "@sevenlabs/coach-core";
import * as api from "../lib/mock-api";

const TTL_GUARD_MS = 20_000; // re-mint this long before the ephemeral expires
const CONFERRING_BEAT_MS = 1500; // "panel is conferring" handoff beat — deliberate, so seat swaps don't feel rushed
const MAX_RECONNECTS = 3;
const SPURIOUS_COACH_MIN_WORDS = 3;
const ICE_DISCONNECT_GRACE_MS = 4000; // ICE "disconnected" is flappy; let it self-heal
const MAX_POLL_ERRORS = 5; // bounded report-poll retries before giving up
const MIN_CAPTURE_MS = 500; // push-to-talk: ignore stray taps shorter than this
// On a same-seat re-mint/reconnect we replay recent turns to restore context.
// Bounded so a long interview never re-bills its whole transcript on every
// re-mint — the active thread lives in the last few turns. (§14.2)
const MAX_REPLAY_TURNS = 12;

/** Pick a MediaRecorder mime Whisper can transcribe; undefined → browser default. */
function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const c of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

/**
 * The full client orchestration: create -> per-seat connect/handoff -> wrap ->
 * debrief-poll -> report, with every recovery path. The pure state machine
 * lives in panel-machine.ts (unit-tested); this hook performs the side effects
 * on phase entry and dispatches the results back.
 */
export function useMockPanel() {
  const [state, dispatch] = useReducer(panelReducer, undefined, initialPanelState);
  // Live transcript + streaming coach text are render-visible state (not refs).
  const [liveTranscript, setLiveTranscript] = useState<
    Array<{ role: "USER" | "COACH"; seatId: string | null; text: string }>
  >([]);
  const [coachStreaming, setCoachStreaming] = useState("");
  // Push-to-talk: whether the candidate's mic is currently open (tapped "Start",
  // not yet "Done"). Ref mirror so toggleCapture branches synchronously.
  const [isCapturing, setIsCapturing] = useState(false);

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
  const greetOnConnectRef = useRef<boolean>(false);
  // Manual turn control (create_response is OFF server-side): the client owns when
  // the interviewer speaks. responseInFlightRef marks an active interviewer turn
  // (set when we send response.create, cleared on response.done) so we never race
  // a second concurrent response; pendingResponseRef remembers that a candidate
  // turn landed mid-response and is owed a reply once the current one finishes.
  const responseInFlightRef = useRef<boolean>(false);
  const pendingResponseRef = useRef<boolean>(false);
  // Output-side stall backstop: fire at most one re-prompt per candidate answer.
  const repromptedRef = useRef<boolean>(false);
  const isCapturingRef = useRef<boolean>(false);
  const captureStartRef = useRef<number>(0);
  // Fluency capture: a per-answer MediaRecorder taps the mic during the PTT
  // window; on Done the blob is uploaded for Whisper word-timing analysis. The
  // clientTurnId is minted at capture-start so the audio upload and the text turn
  // (enqueued later on transcription) share one join key.
  const currentClientTurnIdRef = useRef<string>("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const micLevelRef = useRef<number>(0);
  const speakingRef = useRef<boolean>(false);
  const handledPhaseRef = useRef<string>("");
  const iceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BYOK spend HUD (§3.7): accumulate the estimated cost on the user's key from
  // response.done usage. The cap (set in the green-room) ends the session into the
  // normal complete→report path when crossed — read via a ref so the live callback
  // sees the latest value. estimatedSpendUsd is React state so the meter re-renders.
  const spendUsdRef = useRef<number>(0);
  const spendCapRef = useRef<number | null>(null);
  const [estimatedSpendUsd, setEstimatedSpendUsd] = useState(0);
  const [spendCapUsd, setSpendCapUsdState] = useState<number | null>(null);
  const setSpendCapUsd = useCallback((v: number | null) => {
    spendCapRef.current = v;
    setSpendCapUsdState(v);
  }, []);

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
  // Manual turn trigger: ask the interviewer to take its next turn. Never while
  // one is in flight (the server rejects a second concurrent response with
  // "Conversation already has an active response"), and only while live; a
  // candidate turn that lands mid-response is deferred until response.done.
  const requestCoachResponse = useCallback(() => {
    if (stateRef.current.phase !== "live") return;
    if (responseInFlightRef.current) {
      pendingResponseRef.current = true;
      return;
    }
    responseInFlightRef.current = true;
    peerRef.current?.send({ type: "response.create" });
  }, []);

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
    queueRef.current?.enqueue({
      role: "USER",
      transcript,
      seatId,
      words: [],
      events,
      clientTurnId: currentClientTurnIdRef.current || undefined,
    });
    turnsLogRef.current.push({ role: "user", text: transcript });
    setLiveTranscript((prev) => [...prev, { role: "USER", seatId, text: transcript }]);
    repromptedRef.current = false; // a new answer re-arms the stall backstop
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

    // Output-side turn-control backstop (research: system-prompt hardening is
    // best-effort; pair it with an output check). If the interviewer stalled —
    // asked NO question — and isn't handing off, re-prompt it so the interview
    // can't dead-end (mistake 2 / the "taught then stopped" frame-break). Fires
    // at most once per candidate answer; a SYSTEM nudge keeps the persona intact
    // (per-response instructions would replace it). ⚠️ realtime mechanic —
    // confirm role:"system" item + re-prompt in a live walkthrough.
    if (
      !detectsSentinel(text) &&
      interviewerTurnNeedsContinuation(text) &&
      !repromptedRef.current
    ) {
      repromptedRef.current = true;
      window.setTimeout(() => {
        const peer = peerRef.current;
        if (!peer || responseInFlightRef.current) return;
        peer.send({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: CONTINUATION_NUDGE }],
          },
        });
        requestCoachResponse();
      }, 80);
    }
  }, [activeSeatId, requestCoachResponse]);

  const doConnect = useCallback(async (opts?: { greet?: boolean }) => {
    // Fresh seat connects (create / handoff) → the interviewer speaks first.
    // Re-mint / reconnect replay history and resume instead, so no greeting.
    greetOnConnectRef.current = opts?.greet ?? false;
    responseInFlightRef.current = false;
    pendingResponseRef.current = false;
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
              for (const t of turnsLogRef.current.slice(-MAX_REPLAY_TURNS)) {
                peerRef.current?.pushHistory(t.role, t.text);
              }
            }
          },
          onSessionUpdated: () => {
            // (Re)entering live — clear any stale push-to-talk capture state (e.g.
            // a disconnect mid-answer); the freshly-(re)connected peer's mic starts
            // muted, so the candidate taps "Start answering" again.
            isCapturingRef.current = false;
            setIsCapturing(false);
            if (greetOnConnectRef.current) {
              greetOnConnectRef.current = false;
              // Manual turn control: open the conversation with the interviewer's
              // first turn. A BARE response.create generates it from the seat
              // persona (session instructions) — which greets + asks the first
              // question. No per-response instructions on purpose (they'd OVERRIDE
              // the persona). Mark in-flight so a fast candidate reply defers.
              responseInFlightRef.current = true;
              peerRef.current?.send({ type: "response.create" });
            }
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
            // Log the transcript for the panel/scoring only. The interviewer's
            // reply is triggered when the candidate taps "Done" (toggleCapture →
            // requestCoachResponse), NOT by transcription — so a late, empty, or
            // hallucinated transcript can't make the interviewer respond, and a
            // real answer still gets a reply even if the transcript returns empty.
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
            // Manual control: this interviewer turn is finished. If a candidate
            // turn arrived while it was speaking, it's owed a reply now (skip if
            // we've left live — e.g. a handoff/wrap was triggered by this turn).
            responseInFlightRef.current = false;
            const owed = pendingResponseRef.current;
            pendingResponseRef.current = false;
            if (owed && stateRef.current.phase === "live") {
              responseInFlightRef.current = true;
              peerRef.current?.send({ type: "response.create" });
            }
          },
          onUsage: (usage) => {
            const add = turnCostUsd(usage as RealtimeUsage);
            if (add <= 0) return;
            spendUsdRef.current += add;
            setEstimatedSpendUsd(spendUsdRef.current);
            // Opt-in cap: end the session into the normal complete→report path
            // (safe — the report is never hostage to the user's key). The
            // MAX_SESSION_SEC time stop and the provider's own cap still apply.
            const cap = spendCapRef.current;
            if (cap != null && spendUsdRef.current >= cap && stateRef.current.phase === "live") {
              dispatch({ type: "END_REQUESTED" });
            }
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
          onError: (err) => {
            // A too-short / empty push-to-talk commit is non-fatal (stray tap) —
            // never tear the session down for it.
            const code =
              err && typeof err === "object"
                ? (err as { error?: { code?: string } }).error?.code
                : undefined;
            if (code === "input_audio_buffer_commit_empty") return;
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
  // The single-writer commit queue, built identically for a fresh create and an
  // adopt/resume so the latter keeps seq reconciliation + D6 degraded-delivery
  // detection. Keep the two construction sites from drifting — that's the bug
  // this helper prevents.
  const buildQueue = useCallback(
    (sessionId: string) =>
      createTurnQueue({
        post: (body) => api.postTurn(sessionId, body),
        fetchMaxSeq: async () => {
          const s = await api.getStatus(sessionId);
          return s.kind === "ok" ? s.data.maxSeq : -1;
        },
        onSessionExpired: () => dispatch({ type: "SESSION_EXPIRED" }),
        // A COACH turn dropped after exhausting retries would otherwise vanish
        // silently and the judge would score an incomplete transcript. Surface it
        // so the candidate + report can mark the session partial. (D6)
        onDeliveryError: () => dispatch({ type: "DELIVERY_DEGRADED" }),
      }),
    []
  );

  const doCreate = useCallback(async () => {
    const r = await api.createSession(scenarioRef.current, clientReqRef.current);
    switch (r.kind) {
      case "ok":
        ephemeralRef.current = r.data.ephemeral;
        seatsRef.current = r.data.seats;
        queueRef.current = buildQueue(r.data.sessionId);
        dispatch({
          type: "CREATE_OK",
          sessionId: r.data.sessionId,
          keySource: r.data.keySource,
          seats: r.data.seats,
          maxDurationSec: r.data.spend.maxDurationSec,
          ephemeralExpiresAt: r.data.ephemeral.expiresAt,
        });
        void doConnect({ greet: true });
        break;
      case "duplicate": {
        // Idempotent retry / StrictMode re-create: the session already exists.
        // Adopt it, then rehydrate the seat roster + cursor + queue from the server
        // so a reconnect resumes on the RIGHT seat with non-colliding seqs. (D5)
        dispatch({ type: "CREATE_DUPLICATE", sessionId: r.sessionId });
        const st = await api.getStatus(r.sessionId);
        if (st.kind === "ok") {
          seatsRef.current = st.data.seats;
          const q = buildQueue(r.sessionId);
          q.reconcileSeq(st.data.maxSeq); // continue seq past the persisted turns
          queueRef.current = q;
          dispatch({
            type: "RESUME_SNAPSHOT",
            status: st.data.status,
            seats: st.data.seats,
            activeSeatIndex: st.data.activeSeatIndex,
          });
        }
        break;
      }
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
  }, [doConnect, buildQueue]);

  const doHandoff = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sessionId) return;
    await queueRef.current?.drainBeforeComplete();
    // Let the interviewer's closing line ("…Handing you to my colleague.") finish
    // playing before tearing the peer down — closePeer() pauses the remote audio,
    // which otherwise clips the handoff mid-sentence (2026-06-02 live test #3).
    await peerRef.current?.awaitPlayoutEnd();
    closePeer();
    await new Promise((res) => setTimeout(res, CONFERRING_BEAT_MS));
    const nextIndex = s.activeSeatIndex + 1;
    const r = await api.mint(s.sessionId, { seatIndex: nextIndex, reason: "seat_handoff" });
    if (r.kind === "ephemeral") {
      ephemeralRef.current = r.ephemeral;
      dispatch({ type: "MINT_OK", ephemeralExpiresAt: r.ephemeral.expiresAt });
      void doConnect({ greet: true }); // new seat → that interviewer introduces themselves
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
    await peerRef.current?.awaitPlayoutEnd(); // let any final interviewer line finish
    closePeer();
    stopMic();
    const r = await api.complete(s.sessionId, {
      reason: s.hitCeiling ? "ceiling" : undefined,
      degradedDelivery: s.degradedDelivery,
    });
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
      const rec = recorderRef.current;
      if (rec) {
        rec.onstop = null; // unmount: stop without uploading
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* ignore */
        }
      }
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
      greetOnConnectRef.current = false;
      responseInFlightRef.current = false;
      pendingResponseRef.current = false;
      isCapturingRef.current = false;
      captureStartRef.current = 0;
      currentClientTurnIdRef.current = "";
      {
        const rec = recorderRef.current;
        recorderRef.current = null;
        recordedChunksRef.current = [];
        if (rec) {
          rec.onstop = null;
          try {
            if (rec.state !== "inactive") rec.stop();
          } catch {
            /* ignore */
          }
        }
      }
      speakingRef.current = false;
      pollErrorsRef.current = 0;
      spendUsdRef.current = 0; // reset the spend accumulator (NOT the cap — the
      setEstimatedSpendUsd(0); // user set it in the green-room before this run)
      setLiveTranscript([]);
      setCoachStreaming("");
      setIsCapturing(false);
      dispatch({ type: "START" });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Explicit AEC so the interviewer's own audio (laptop speakers) can't
          // echo back into the mic and trip a spurious turn. On by default for
          // WebRTC capture, but stated explicitly — OpenAI's server does NO echo
          // cancellation, so it is entirely the client's responsibility.
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;
        startMicMeter(stream);
        dispatch({ type: "MIC_GRANTED" });
      } catch {
        dispatch({ type: "MIC_DENIED" });
      }
    },
    [startMicMeter, closePeer, stopMic]
  );

  // Fluency capture lifecycle (parallel to the realtime conversation, best-effort).
  const startTurnRecorder = useCallback(() => {
    recordedChunksRef.current = [];
    recorderRef.current = null;
    const stream = micStreamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    try {
      const mime = pickRecorderMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
    } catch {
      recorderRef.current = null;
    }
  }, []);

  const stopTurnRecorder = useCallback((upload: boolean) => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec) {
      recordedChunksRef.current = [];
      return;
    }
    const sessionId = stateRef.current.sessionId;
    const clientTurnId = currentClientTurnIdRef.current;
    rec.onstop = () => {
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (!upload || chunks.length === 0 || !sessionId || !clientTurnId) return;
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size > 0) void api.uploadTurnAudio(sessionId, clientTurnId, blob);
    };
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch {
      recordedChunksRef.current = [];
    }
  }, []);

  // Push-to-talk: tap to start answering, tap "Done" to send. The interviewer's
  // reply fires on Done (commit + response.create), so a long answer with any
  // number of thinking pauses is never cut off mid-sentence. A MediaRecorder runs
  // alongside, gated to the same window, so each answer can be scored for fluency.
  const toggleCapture = useCallback(() => {
    if (isCapturingRef.current) {
      isCapturingRef.current = false;
      setIsCapturing(false);
      speakingRef.current = false;
      const longEnough = Date.now() - captureStartRef.current >= MIN_CAPTURE_MS;
      stopTurnRecorder(longEnough); // only upload a real answer's audio
      if (longEnough) {
        peerRef.current?.commitCapture();
        requestCoachResponse(); // ask the interviewer to reply to the committed answer
      } else {
        peerRef.current?.discardCapture(); // stray/too-short tap — drop it, no empty commit
      }
      return;
    }
    // Start only on the candidate's turn (live, interviewer not currently speaking).
    if (stateRef.current.phase !== "live" || stateRef.current.coachResponseInFlight) return;
    isCapturingRef.current = true;
    setIsCapturing(true);
    speakingRef.current = true; // keep the TTL watchdog from re-minting mid-answer
    captureStartRef.current = Date.now();
    currentClientTurnIdRef.current = crypto.randomUUID();
    peerRef.current?.beginCapture();
    startTurnRecorder();
  }, [requestCoachResponse, startTurnRecorder, stopTurnRecorder]);

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
    degradedDelivery: state.degradedDelivery,
    keySource: state.keySource,
    estimatedSpendUsd,
    spendCapUsd,
    setSpendCapUsd,
    report: state.report,
    recovery: state.recovery as RecoveryKind | null,
    errorMessage: state.errorMessage,
    sessionId: state.sessionId,
    liveTranscript,
    coachStreaming,
    isCapturing,
    micLevelRef,
    start,
    toggleCapture,
    endAndScore,
    retryConnect,
    startOver,
    dismissError,
  };
}
