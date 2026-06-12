/**
 * The Realtime input-session config — the SINGLE source shared by both the
 * server mint body (src/lib/coach/openai.ts → session.audio.input) and the
 * client data-channel patch (mock-panel/lib/realtime-connection.ts →
 * INPUT_SESSION_PATCH). Previously these were copy-pasted with a "MUST stay
 * identical" comment; importing one const means they can't silently diverge.
 *
 * PUSH-TO-TALK: turn_detection is null — NO automatic VAD. The candidate owns
 * end-of-turn (the client gates the mic track and sends input_audio_buffer.commit
 * + response.create on "Done"). This is the only design that can't cut a long,
 * thoughtful answer off mid-sentence, and committing only deliberate speech stops
 * the transcription model hallucinating text out of silence. It is asserted at
 * mint so the client can't race it, and re-asserted by the client on data-channel
 * open (belt-and-suspenders). language:"en" removes the auto-language-detect step
 * that produced foreign-script boilerplate on near-silent audio. (Verified GA.)
 */
export const REALTIME_INPUT_CONFIG = {
  transcription: { model: "gpt-4o-transcribe", language: "en" },
  turn_detection: null,
};
