import type { RealtimeEphemeral } from "@sevenlabs/shared-types";

/**
 * STEP-1 THROWAWAY dev harness (REALTIME_CLIENT_PLAN.md step 1). Connects ONE
 * ephemeral with RAW WebRTC + verbose logging — independent of realtime-
 * connection.ts — so the operator can confirm, against the LIVE GA API, that:
 *   (a) SDP POST to ephemeral.realtimeUrl (/v1/realtime/calls) succeeds;
 *   (b) USER speech yields conversation.item.input_audio_transcription.completed;
 *   (c) COACH replies emit response.output_audio_transcript.delta/.done;
 *   (d) input_audio_buffer.speech_started/.speech_stopped fire;
 *   (e) response.created/.done fire (barge-in => response.done cancelled).
 * Set sendSessionUpdate:false to prove the mint config alone enables input
 * transcription. DELETE this file + its route after Step 1 passes.
 */
export interface HarnessHandle {
  close: () => void;
}

export async function runHarness(opts: {
  ephemeral: RealtimeEphemeral;
  micStream: MediaStream;
  sendSessionUpdate?: boolean;
}): Promise<HarnessHandle> {
  const { ephemeral, micStream, sendSessionUpdate = true } = opts;
  const seen: Record<string, number> = {};
  let userTranscripts = 0;
  let coachDeltas = 0;
  let coachDones = 0;
  const log = (...a: unknown[]) => console.log("[harness]", ...a);

  const pc = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    void audio.play().catch(() => {});
    log("ontrack: remote audio attached");
  };
  pc.oniceconnectionstatechange = () => log("ice:", pc.iceConnectionState);
  for (const t of micStream.getAudioTracks()) pc.addTrack(t, micStream);

  const dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    log("data channel open");
    if (sendSessionUpdate) {
      dc.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            audio: {
              input: {
                transcription: { model: "gpt-4o-transcribe" },
                turn_detection: { type: "server_vad" },
              },
            },
          },
        })
      );
      log("sent session.update (input transcription + server VAD)");
    } else {
      log("SKIPPED client session.update — relying on mint config alone");
    }
  };
  dc.onmessage = (e) => {
    let msg: { type?: string; transcript?: string };
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    const type = msg.type ?? "unknown";
    seen[type] = (seen[type] ?? 0) + 1;
    if (type === "conversation.item.input_audio_transcription.completed") {
      userTranscripts += 1;
      log("USER transcript:", msg.transcript);
    } else if (type === "response.output_audio_transcript.delta") {
      coachDeltas += 1;
    } else if (type === "response.output_audio_transcript.done") {
      coachDones += 1;
      log("COACH transcript done:", msg.transcript);
    } else {
      log("event:", type);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  log("POST SDP ->", ephemeral.realtimeUrl);
  const res = await fetch(ephemeral.realtimeUrl, {
    method: "POST",
    body: offer.sdp ?? "",
    headers: {
      Authorization: `Bearer ${ephemeral.value}`,
      "Content-Type": "application/sdp",
    },
  });
  log("SDP exchange status:", res.status);
  if (!res.ok) {
    log("FAILED SDP exchange");
    pc.close();
    throw new Error(`sdp ${res.status}`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  log("connected — speak now, then Stop to print the summary.");

  return {
    close: () => {
      log("=== HARNESS SUMMARY ===");
      log("event types seen:", seen);
      log(`USER transcripts: ${userTranscripts} | COACH deltas: ${coachDeltas} | dones: ${coachDones}`);
      log(
        "Confirm: SDP 200/201; USER transcripts > 0; COACH delta+done > 0; " +
          "speech_started/stopped present; response.created/done present."
      );
      audio.pause();
      audio.srcObject = null;
      dc.close();
      pc.close();
    },
  };
}
