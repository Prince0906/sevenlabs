import type { RealtimeEphemeral } from "@sevenlabs/shared-types";

/**
 * Headless WebRTC transport around ONE ephemeral (one panel seat). No React.
 * The audio path is browser <-> OpenAI directly; the server is never in it.
 *
 * GA, not Beta: the SDP offer is POSTed to ephemeral.realtimeUrl
 * (/v1/realtime/calls) with Content-Type: application/sdp + Bearer
 * ephemeral.value and NO ?model= (the model is bound to the ephemeral). On
 * data-channel open we send a session.update enabling input transcription +
 * server VAD (belt-and-suspenders over the mint config) and the caller waits
 * for onSessionUpdated before accepting speech. (REALTIME_CLIENT_PLAN.md step 8.)
 */
export interface RealtimeCallbacks {
  onSessionUpdated?: () => void;
  onUserTranscript?: (transcript: string) => void;
  onCoachTranscriptDelta?: (delta: string) => void;
  onCoachTranscriptDone?: (transcript: string) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onCoachResponseStart?: () => void;
  onCoachResponseDone?: (cancelled: boolean) => void;
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
  /** 0..1 gain on the remote (coach) audio — used for the handoff dim cue. */
  setOutputGain: (gain: number) => void;
  /** Tear down: pause+detach remote audio, close dc+pc. Leaves micStream alive. */
  close: () => void;
}

const INPUT_SESSION_PATCH = {
  type: "realtime",
  audio: {
    input: {
      transcription: { model: "gpt-4o-transcribe" },
      turn_detection: { type: "server_vad" },
    },
  },
};

export async function connectRealtime(params: {
  ephemeral: RealtimeEphemeral;
  micStream: MediaStream;
  callbacks: RealtimeCallbacks;
}): Promise<RealtimePeer> {
  const { ephemeral, micStream, callbacks } = params;
  const pc = new RTCPeerConnection();

  // Remote (coach) audio sink. Detached on close; the element is owned here.
  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
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
    remoteAudio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    playRemote();
  };

  pc.oniceconnectionstatechange = () => {
    callbacks.onConnectionStateChange?.(pc.iceConnectionState);
  };

  // Our mic into the peer (server VAD segments it).
  for (const track of micStream.getAudioTracks()) {
    pc.addTrack(track, micStream);
  }

  const dc = pc.createDataChannel("oai-events");

  const send = (event: Record<string, unknown>) => {
    if (dc.readyState === "open") dc.send(JSON.stringify(event));
  };

  dc.onopen = () => {
    // Belt-and-suspenders: re-assert input transcription + server VAD. The
    // caller gates `live` on onSessionUpdated so we never accept speech first.
    send({ type: "session.update", session: INPUT_SESSION_PATCH });
    callbacks.onDataChannelOpen?.();
  };

  dc.onmessage = (e) => {
    let msg: { type?: string; transcript?: string; delta?: string; response?: { status?: string } };
    try {
      msg = JSON.parse(typeof e.data === "string" ? e.data : "");
    } catch {
      return;
    }
    switch (msg.type) {
      case "session.updated":
        callbacks.onSessionUpdated?.();
        break;
      case "conversation.item.input_audio_transcription.completed":
        callbacks.onUserTranscript?.(msg.transcript ?? "");
        break;
      case "response.output_audio_transcript.delta":
        callbacks.onCoachTranscriptDelta?.(msg.delta ?? "");
        break;
      case "response.output_audio_transcript.done":
        callbacks.onCoachTranscriptDone?.(msg.transcript ?? "");
        break;
      case "input_audio_buffer.speech_started":
        callbacks.onSpeechStarted?.();
        break;
      case "input_audio_buffer.speech_stopped":
        callbacks.onSpeechStopped?.();
        break;
      case "response.created":
        callbacks.onCoachResponseStart?.();
        break;
      case "response.done":
        callbacks.onCoachResponseDone?.(msg.response?.status === "cancelled");
        break;
      case "error":
        // A server-side error event (e.g. a rejected conversation.item.create
        // on re-mint replay) — surface it instead of silently degrading.
        callbacks.onError?.(msg);
        break;
      default:
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
      // which would drop coach context on re-mint (the load-bearing
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
    setOutputGain: (gain) => {
      remoteAudio.volume = Math.min(1, Math.max(0, gain));
    },
    close: () => {
      clearAudioGesture();
      try {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
      } catch {
        /* ignore */
      }
      try {
        dc.close();
      } catch {
        /* ignore */
      }
      pc.close(); // leaves the shared micStream tracks alive for the next seat
    },
  };
}
