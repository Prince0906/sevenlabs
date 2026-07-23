import { type RealtimeEphemeral, REALTIME_INPUT_CONFIG } from "@sevenlabs/shared-types";
import { mapRealtimeEvent } from "./realtime-events";

/**
 * Headless WebRTC transport around ONE ephemeral (one panel seat). No React.
 * The audio path is browser <-> OpenAI directly; the server is never in it.
 *
 * GA, not Beta: the SDP offer is POSTed to ephemeral.realtimeUrl
 * (/v1/realtime/calls) with Content-Type: application/sdp + Bearer
 * ephemeral.value and NO ?model= (the model is bound to the ephemeral). On
 * data-channel open we send a session.update re-asserting input transcription +
 * manual turn control (turn_detection null — push-to-talk, no VAD), belt-and-
 * suspenders over the mint config, and the caller waits for onSessionUpdated
 * before accepting speech.
 */
export interface RealtimeCallbacks {
  onSessionUpdated?: () => void;
  onUserTranscript?: (transcript: string) => void;
  onInterviewerTranscriptDelta?: (delta: string) => void;
  onInterviewerTranscriptDone?: (transcript: string) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onInterviewerResponseStart?: () => void;
  onInterviewerResponseDone?: (cancelled: boolean) => void;
  /** Token usage on response.done — drives the BYOK spend estimate (§3.7). */
  onUsage?: (usage: unknown) => void;
  onDataChannelOpen?: () => void;
  onConnectionStateChange?: (state: RTCIceConnectionState) => void;
  onError?: (err: unknown) => void;
}

export interface RealtimePeer {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  remoteAudio: HTMLAudioElement;
  /** Send an arbitrary client event over the data channel. */
  send: (event: Record<string, unknown>) => void;
  /** Patch the session config (e.g. re-enable transcription). */
  sendSessionUpdate: (sessionPatch: Record<string, unknown>) => void;
  /** Replay one prior turn into a fresh session as conversation context. */
  pushHistory: (role: "user" | "assistant", text: string) => void;
  /** Push-to-talk: open the mic for the candidate's turn (clear stale audio + unmute). */
  beginCapture: () => void;
  /** Push-to-talk "Done": mute the mic and commit the captured audio as a user item. */
  commitCapture: () => void;
  /** Push-to-talk abort (too-short/stray tap): mute the mic and discard the buffer uncommitted. */
  discardCapture: () => void;
  /** 0..1 gain on the remote (interviewer) audio — used for the handoff dim cue. */
  setOutputGain: (gain: number) => void;
  /** Resolve once the interviewer's audio has finished playing out (the remote
   * stream has gone quiet for a beat), or after timeoutMs as a hard backstop, so
   * a handoff teardown never clips the interviewer mid-sentence. */
  awaitPlayoutEnd: (timeoutMs?: number) => Promise<void>;
  /** Tear down: pause+detach remote audio, close dc+pc. Leaves micStream alive. */
  close: () => void;
}

// Re-assert the shared input config on data-channel open (belt-and-suspenders
// over the mint-time config). REALTIME_INPUT_CONFIG is the single source, so the
// mint body and this patch can no longer silently diverge. Full push-to-talk
// rationale lives on that const.
const INPUT_SESSION_PATCH = {
  type: "realtime",
  audio: { input: REALTIME_INPUT_CONFIG },
};

export async function connectRealtime(params: {
  ephemeral: RealtimeEphemeral;
  micStream: MediaStream;
  callbacks: RealtimeCallbacks;
}): Promise<RealtimePeer> {
  const { ephemeral, micStream, callbacks } = params;
  const pc = new RTCPeerConnection();

  // Remote (interviewer) audio sink. Detached on close; the element is owned here.
  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  // Energy meter on the remote stream — analysis only (never connected to the
  // destination, so it can't affect the <audio> element's playback). Powers
  // awaitPlayoutEnd so a handoff waits for the interviewer to finish speaking.
  let remoteAudioCtx: AudioContext | null = null;
  let remoteAnalyser: AnalyserNode | null = null;
  // Autoplay can be blocked (Safari/iOS, gesture-less handoff/re-mint). On
  // rejection, retry play() on the next user gesture rather than going silently
  // mute while transcripts keep streaming.
  let audioGestureHandler: (() => void) | null = null;
  const clearAudioGesture = () => {
    if (audioGestureHandler) {
      document.removeEventListener("pointerdown", audioGestureHandler);
      audioGestureHandler = null;
    }
  };
  const playRemote = () => {
    remoteAudio
      .play()
      .then(clearAudioGesture)
      .catch(() => {
        if (!audioGestureHandler) {
          audioGestureHandler = () => playRemote();
          document.addEventListener("pointerdown", audioGestureHandler);
        }
      });
  };
  pc.ontrack = (e) => {
    const stream = e.streams[0] ?? new MediaStream([e.track]);
    remoteAudio.srcObject = stream;
    playRemote();
    try {
      remoteAudioCtx = new AudioContext();
      // May start suspended under autoplay policy; a suspended ctx reads silence,
      // which would make awaitPlayoutEnd resolve early and re-clip the handoff.
      void remoteAudioCtx.resume().catch(() => {});
      const src = remoteAudioCtx.createMediaStreamSource(stream);
      remoteAnalyser = remoteAudioCtx.createAnalyser();
      remoteAnalyser.fftSize = 512;
      src.connect(remoteAnalyser);
    } catch {
      remoteAnalyser = null;
    }
  };

  pc.oniceconnectionstatechange = () => {
    callbacks.onConnectionStateChange?.(pc.iceConnectionState);
  };

  // Our mic into the peer. Push-to-talk: the track is added for the life of the
  // peer but starts MUTED (enabled=false transmits silence), so nothing reaches
  // the server's input buffer between turns. beginCapture/commitCapture toggle it.
  const micTracks = micStream.getAudioTracks();
  for (const track of micTracks) {
    track.enabled = false;
    pc.addTrack(track, micStream);
  }

  const dc = pc.createDataChannel("oai-events");

  const send = (event: Record<string, unknown>) => {
    if (dc.readyState === "open") dc.send(JSON.stringify(event));
  };

  dc.onopen = () => {
    // Belt-and-suspenders: re-assert input transcription + manual turn control
    // (turn_detection null). The caller gates `live` on onSessionUpdated.
    send({ type: "session.update", session: INPUT_SESSION_PATCH });
    callbacks.onDataChannelOpen?.();
  };

  dc.onmessage = (e) => {
    // The single untrusted-JSON boundary; mapping is pure + unit-tested in
    // realtime-events.ts. Unknown/malformed payloads return null (ignored).
    const ev = mapRealtimeEvent(e.data);
    if (!ev) return;
    switch (ev.type) {
      case "session_updated":
        callbacks.onSessionUpdated?.();
        break;
      case "user_transcript":
        callbacks.onUserTranscript?.(ev.transcript);
        break;
      case "interviewer_transcript_delta":
        callbacks.onInterviewerTranscriptDelta?.(ev.delta);
        break;
      case "interviewer_transcript_done":
        callbacks.onInterviewerTranscriptDone?.(ev.transcript);
        break;
      case "speech_started":
        callbacks.onSpeechStarted?.();
        break;
      case "speech_stopped":
        callbacks.onSpeechStopped?.();
        break;
      case "interviewer_response_start":
        callbacks.onInterviewerResponseStart?.();
        break;
      case "interviewer_response_done":
        callbacks.onInterviewerResponseDone?.(ev.cancelled);
        if (ev.usage) callbacks.onUsage?.(ev.usage);
        break;
      case "server_error":
        callbacks.onError?.(ev.raw);
        break;
    }
  };
  dc.onerror = () => callbacks.onError?.(new Error("data channel error"));

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const res = await fetch(ephemeral.realtimeUrl, {
      method: "POST",
      body: offer.sdp ?? "",
      headers: {
        Authorization: `Bearer ${ephemeral.value}`,
        "Content-Type": "application/sdp",
      },
    });
    if (!res.ok) throw new Error(`realtime SDP exchange failed: ${res.status}`);
    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  } catch (err) {
    callbacks.onError?.(err);
    pc.close();
    throw err;
  }

  return {
    pc,
    dc,
    remoteAudio,
    send,
    sendSessionUpdate: (sessionPatch) =>
      send({ type: "session.update", session: sessionPatch }),
    pushHistory: (role, text) =>
      // GA content-part types (verified live against /v1/realtime): user items
      // use "input_text"; assistant items MUST use "output_text" — the server
      // rejects "text" with `Invalid value: 'text'. Value must be 'output_text'`,
      // which would drop interviewer context on re-mint (the load-bearing
      // persona-coherence path) and surface a spurious error event.
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role,
          ...(role === "assistant" ? { status: "completed" } : {}),
          content: [{ type: role === "user" ? "input_text" : "output_text", text }],
        },
      }),
    beginCapture: () => {
      // Drop anything that leaked into the buffer since the last turn, then open
      // the mic. The model's output audio is unaffected (separate track).
      send({ type: "input_audio_buffer.clear" });
      for (const track of micTracks) track.enabled = true;
    },
    commitCapture: () => {
      for (const track of micTracks) track.enabled = false;
      send({ type: "input_audio_buffer.commit" }); // → committed → transcription; caller sends response.create
    },
    discardCapture: () => {
      for (const track of micTracks) track.enabled = false;
      send({ type: "input_audio_buffer.clear" });
    },
    setOutputGain: (gain) => {
      remoteAudio.volume = Math.min(1, Math.max(0, gain));
    },
    awaitPlayoutEnd: (timeoutMs = 9000) =>
      new Promise<void>((resolve) => {
        const analyser = remoteAnalyser;
        let raf = 0;
        let done = false;
        // setTimeout (not rAF) is the hard backstop: rAF pauses in a backgrounded
        // tab, so it alone could hang the handoff indefinitely.
        const finish = () => {
          if (done) return;
          done = true;
          cancelAnimationFrame(raf);
          clearTimeout(hard);
          resolve();
        };
        // No analyser (Safari/iOS autoplay-suspend) → fixed tail. 1200ms clipped
        // the interviewer's 2-3s closing line on a big share of mobile; 3000ms
        // leaves margin. The handoff "conferring" beat hides this delay.
        const hard = setTimeout(finish, analyser ? timeoutMs : 3000);
        if (!analyser) return; // no meter — the fixed tail above resolves it
        const data = new Uint8Array(analyser.frequencyBinCount);
        const QUIET_RMS = 0.015;
        const QUIET_MS = 400;
        let quietSince = 0;
        const tick = () => {
          if (done) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i]! - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const now = performance.now();
          if (rms < QUIET_RMS) {
            if (quietSince === 0) quietSince = now;
            if (now - quietSince >= QUIET_MS) return finish();
          } else {
            quietSince = 0;
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      }),
    close: () => {
      clearAudioGesture();
      try {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
      } catch {
        /* ignore */
      }
      remoteAnalyser = null;
      void remoteAudioCtx?.close().catch(() => {});
      remoteAudioCtx = null;
      try {
        dc.close();
      } catch {
        /* ignore */
      }
      pc.close(); // leaves the shared micStream tracks alive for the next seat
    },
  };
}
