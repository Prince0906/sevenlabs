"use client";

import { useEffect, useRef } from "react";
import { MicVAD, utils } from "@ricky0123/vad-web";

interface PracticeVadProps {
  enabled: boolean;
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Blob) => void;
  /** Live mic amplitude (0..1) per processed frame, for the voice orb. */
  onAudioLevel?: (level: number) => void;
}

export function PracticeVad({
  enabled,
  onSpeechStart,
  onSpeechEnd,
  onAudioLevel,
}: PracticeVadProps) {
  const vadRef = useRef<MicVAD | null>(null);
  const callbacksRef = useRef({ onSpeechStart, onSpeechEnd, onAudioLevel });

  useEffect(() => {
    callbacksRef.current = { onSpeechStart, onSpeechEnd, onAudioLevel };
  }, [onSpeechStart, onSpeechEnd, onAudioLevel]);

  useEffect(() => {
    if (!enabled) {
      vadRef.current?.pause();
      callbacksRef.current.onAudioLevel?.(0);
      return;
    }

    let cancelled = false;

    async function init() {
      const vad = await MicVAD.new({
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
        // Wait longer before deciding speech has ended — users pause to think
        redemptionMs: 2000,
        // Require higher confidence before triggering speech start
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.3,
        // Require a minimum speech duration before triggering
        minSpeechMs: 500,
        onFrameProcessed: (_probs, frame) => {
          let sum = 0;
          for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
          const rms = Math.sqrt(sum / frame.length);
          callbacksRef.current.onAudioLevel?.(Math.min(1, rms * 5));
        },
        onSpeechStart: () => callbacksRef.current.onSpeechStart(),
        onSpeechEnd: (audio) => {
          const wavBuffer = utils.encodeWAV(audio);
          const blob = new Blob([new Uint8Array(wavBuffer)], {
            type: "audio/wav",
          });
          callbacksRef.current.onSpeechEnd(blob);
        },
      });
      if (cancelled) {
        vad.destroy();
        return;
      }
      vadRef.current = vad;
      vad.start();
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      vadRef.current?.destroy();
      vadRef.current = null;
    };
  }, [enabled]);

  return null;
}
