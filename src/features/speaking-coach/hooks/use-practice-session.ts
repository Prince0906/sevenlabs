"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechMetrics, TurnCompleteResponse } from "@sevenlabs/shared-types";

export type PracticePhase =
  | "idle"
  | "coach-speaking"
  | "your-turn"
  | "listening"
  | "analyzing";

export interface TurnRecord {
  clientTurnId: string;
  transcript: string;
  metrics: SpeechMetrics | null;
  coachText: string;
}

export function usePracticeSession() {
  const [phase, setPhase] = useState<PracticePhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openingCoachText, setOpeningCoachText] = useState<string>("");
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const playAudio = useCallback(async (url?: string) => {
    if (!url) {
      setPhase("your-turn");
      return;
    }
    setPhase("coach-speaking");
    const audio = new Audio(url);
    audioRef.current = audio;
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      audio.play().catch(reject);
    });
    setPhase("your-turn");
  }, []);

  const startSession = useCallback(async () => {
    setStarting(true);
    try {
      setError(null);
      setTurns([]);
      const res = await fetch("/api/coach/session", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start session");
      }
      const data = (await res.json()) as {
        sessionId: string;
        openingCoachText: string;
        openingCoachAudioUrl?: string;
      };
      setSessionId(data.sessionId);
      setOpeningCoachText(data.openingCoachText);
      await playAudio(data.openingCoachAudioUrl);
    } finally {
      setStarting(false);
    }
  }, [playAudio]);

  const submitTurn = useCallback(
    async (clientTurnId: string, audioBlob: Blob) => {
      if (!sessionId) throw new Error("No active session");
      setPhase("analyzing");
      setError(null);

      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("clientTurnId", clientTurnId);
      form.append("audio", audioBlob, "utterance.wav");

      const res = await fetch("/api/coach/turn", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Turn failed");
      }

      const data = (await res.json()) as TurnCompleteResponse;
      setTurns((prev) => [
        ...prev,
        {
          clientTurnId,
          transcript: data.transcript,
          metrics: data.metrics,
          coachText: data.coachText,
        },
      ]);
      await playAudio(data.coachAudioUrl);
    },
    [sessionId, playAudio]
  );

  return {
    phase,
    setPhase,
    sessionId,
    openingCoachText,
    turns,
    error,
    setError,
    starting,
    startSession,
    submitTurn,
  };
}
