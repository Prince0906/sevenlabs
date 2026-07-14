import { describe, it, expect } from "vitest";
import { mapRealtimeEvent } from "@/features/interview/lib/realtime-events";

/** Helper: events arrive as JSON strings over the data channel. */
const ev = (obj: unknown) => mapRealtimeEvent(JSON.stringify(obj));

describe("mapRealtimeEvent — happy-path event mapping", () => {
  it("maps session.updated", () => {
    expect(ev({ type: "session.updated" })).toEqual({ type: "session_updated" });
  });

  it("maps a completed user transcript", () => {
    expect(
      ev({ type: "conversation.item.input_audio_transcription.completed", transcript: "hello there" })
    ).toEqual({ type: "user_transcript", transcript: "hello there" });
  });

  it("defaults a missing user transcript to empty string (never undefined)", () => {
    expect(
      ev({ type: "conversation.item.input_audio_transcription.completed" })
    ).toEqual({ type: "user_transcript", transcript: "" });
  });

  it("maps coach transcript delta + done", () => {
    expect(ev({ type: "response.output_audio_transcript.delta", delta: "Tell " })).toEqual({
      type: "coach_transcript_delta",
      delta: "Tell ",
    });
    expect(
      ev({ type: "response.output_audio_transcript.done", transcript: "Tell me about a time…" })
    ).toEqual({ type: "coach_transcript_done", transcript: "Tell me about a time…" });
  });

  it("defaults a missing delta/transcript to empty string", () => {
    expect(ev({ type: "response.output_audio_transcript.delta" })).toEqual({
      type: "coach_transcript_delta",
      delta: "",
    });
    expect(ev({ type: "response.output_audio_transcript.done" })).toEqual({
      type: "coach_transcript_done",
      transcript: "",
    });
  });

  it("maps speech start/stop", () => {
    expect(ev({ type: "input_audio_buffer.speech_started" })).toEqual({ type: "speech_started" });
    expect(ev({ type: "input_audio_buffer.speech_stopped" })).toEqual({ type: "speech_stopped" });
  });

  it("maps response.created", () => {
    expect(ev({ type: "response.created" })).toEqual({ type: "coach_response_start" });
  });
});

describe("mapRealtimeEvent — response.done (cancelled + usage)", () => {
  it("flags a cancelled response (barge-in)", () => {
    expect(ev({ type: "response.done", response: { status: "cancelled" } })).toEqual({
      type: "coach_response_done",
      cancelled: true,
      usage: null,
    });
  });

  it("a completed response is not cancelled and carries usage when present", () => {
    const usage = { input_tokens: 10, output_tokens: 20 };
    expect(ev({ type: "response.done", response: { status: "completed", usage } })).toEqual({
      type: "coach_response_done",
      cancelled: false,
      usage,
    });
  });

  it("usage is null when the response carries none", () => {
    expect(ev({ type: "response.done", response: { status: "completed" } })).toEqual({
      type: "coach_response_done",
      cancelled: false,
      usage: null,
    });
    // No response object at all is still a valid (uncancelled, usage-less) done.
    expect(ev({ type: "response.done" })).toEqual({
      type: "coach_response_done",
      cancelled: false,
      usage: null,
    });
  });
});

describe("mapRealtimeEvent — server error passthrough", () => {
  it("surfaces a server error event with its raw payload", () => {
    const raw = { type: "error", error: { message: "bad item" } };
    expect(mapRealtimeEvent(JSON.stringify(raw))).toEqual({ type: "server_error", raw });
  });
});

describe("mapRealtimeEvent — untrusted input never throws, returns null", () => {
  it("ignores an unknown event type", () => {
    expect(ev({ type: "rate_limits.updated" })).toBeNull();
    expect(ev({ type: "response.output_audio.delta" })).toBeNull();
  });

  it("ignores a message with no type", () => {
    expect(ev({ transcript: "orphan" })).toBeNull();
  });

  it("returns null (no throw) on malformed JSON", () => {
    expect(mapRealtimeEvent("{ not json")).toBeNull();
    expect(mapRealtimeEvent("")).toBeNull();
  });

  it("returns null (no throw) on non-string data (e.g. a binary frame)", () => {
    expect(mapRealtimeEvent(new ArrayBuffer(8))).toBeNull();
    expect(mapRealtimeEvent(undefined)).toBeNull();
    expect(mapRealtimeEvent(null)).toBeNull();
    expect(mapRealtimeEvent(42)).toBeNull();
  });

  it("returns null when JSON parses to a non-object (null/number/string)", () => {
    expect(mapRealtimeEvent("null")).toBeNull();
    expect(mapRealtimeEvent("123")).toBeNull();
    expect(mapRealtimeEvent('"a string"')).toBeNull();
  });
});
