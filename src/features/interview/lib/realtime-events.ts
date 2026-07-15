/**
 * Pure mapper from a raw OpenAI Realtime data-channel message to a typed
 * transport event (or null to ignore). Split out of realtime-connection.ts so
 * the one place where UNTRUSTED OpenAI JSON becomes app state is unit-testable
 * without a WebRTC peer: malformed/unknown payloads must yield null, never throw
 * and never half-drive a callback. The transport (realtime-connection.ts) maps
 * each event to its callback; the FSM reducer never sees raw JSON.
 */
export type TransportEvent =
  | { type: "session_updated" }
  | { type: "user_transcript"; transcript: string }
  | { type: "interviewer_transcript_delta"; delta: string }
  | { type: "interviewer_transcript_done"; transcript: string }
  | { type: "speech_started" }
  | { type: "speech_stopped" }
  | { type: "interviewer_response_start" }
  | { type: "interviewer_response_done"; cancelled: boolean; usage: unknown | null }
  | { type: "server_error"; raw: unknown };

export function mapRealtimeEvent(data: unknown): TransportEvent | null {
  let msg: {
    type?: string;
    transcript?: string;
    delta?: string;
    response?: { status?: string; usage?: unknown };
  };
  try {
    msg = JSON.parse(typeof data === "string" ? data : "");
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object") return null;

  switch (msg.type) {
    case "session.updated":
      return { type: "session_updated" };
    case "conversation.item.input_audio_transcription.completed":
      return { type: "user_transcript", transcript: msg.transcript ?? "" };
    case "response.output_audio_transcript.delta":
      return { type: "interviewer_transcript_delta", delta: msg.delta ?? "" };
    case "response.output_audio_transcript.done":
      return { type: "interviewer_transcript_done", transcript: msg.transcript ?? "" };
    case "input_audio_buffer.speech_started":
      return { type: "speech_started" };
    case "input_audio_buffer.speech_stopped":
      return { type: "speech_stopped" };
    case "response.created":
      return { type: "interviewer_response_start" };
    case "response.done":
      return {
        type: "interviewer_response_done",
        cancelled: msg.response?.status === "cancelled",
        usage: msg.response?.usage ?? null,
      };
    case "error":
      // A server-side error event (e.g. a rejected conversation.item.create on
      // re-mint replay) — surface it instead of silently degrading.
      return { type: "server_error", raw: msg };
    default:
      return null;
  }
}
