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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const playAudio = useCallback(async (url?: string) => {
    if (!url) {
      if (mountedRef.current) setPhase("your-turn");
      return;
    }
    if (mountedRef.current) setPhase("coach-speaking");
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio playback failed"));
        audio.play().catch(reject);
      });
    } catch {
      // Audio was stopped or failed — don't transition phase
      if (!mountedRef.current) return;
    }
    if (mountedRef.current && audioRef.current === audio) {
      setPhase("your-turn");
    }
  }, [stopAudio]);

  const stopSession = useCallback(() => {
    stopAudio();
    setSessionId(null);
    setPhase("idle");
    setError(null);
    setStarting(false);
  }, [stopAudio]);

  const startSession = useCallback(async (mode: string = "delivery") => {
    setStarting(true);
    try {
      setError(null);
      setTurns([]);
      const res = await fetch("/api/coach/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start session");
      }
      const data = (await res.json()) as {
        sessionId: string;
        openingCoachText: string;
        openingCoachAudioUrl?: string;
      };
      if (!mountedRef.current) return;
      setSessionId(data.sessionId);
      setOpeningCoachText(data.openingCoachText);
      await playAudio(data.openingCoachAudioUrl);
    } finally {
      if (mountedRef.current) setStarting(false);
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
      if (!mountedRef.current) return;
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
    stopSession,
    submitTurn,
  };
}
