"use client";

import { useEffect, useRef } from "react";
import { MicVAD, utils } from "@ricky0123/vad-web";

interface PracticeVadProps {
  enabled: boolean;
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Blob) => void;
}

export function PracticeVad({
  enabled,
  onSpeechStart,
  onSpeechEnd,
}: PracticeVadProps) {
  const vadRef = useRef<MicVAD | null>(null);
  const callbacksRef = useRef({ onSpeechStart, onSpeechEnd });

  useEffect(() => {
    callbacksRef.current = { onSpeechStart, onSpeechEnd };
  }, [onSpeechStart, onSpeechEnd]);

  useEffect(() => {
    if (!enabled) {
      vadRef.current?.pause();
      return;
    }

    let cancelled = false;

    async function init() {
      const vad = await MicVAD.new({
        baseAssetPath: "/vad/",
        onnxWASMBasePath: "/vad/",
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
