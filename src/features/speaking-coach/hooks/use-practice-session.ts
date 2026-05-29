"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RubricScores,
  SpeechMetrics,
  TurnCompleteResponse,
} from "@sevenlabs/shared-types";

export type PracticePhase =
  | "idle"
  | "coach-speaking"
  | "your-turn"
  | "listening"
  | "analyzing"
  | "summary";

export interface TurnRecord {
  clientTurnId: string;
  transcript: string;
  metrics: SpeechMetrics | null;
  coachText: string;
  rubricScores: RubricScores | null;
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
    setError(null);
    setStarting(false);
    setTurns((prev) => {
      if (prev.length > 0) {
        setPhase("summary");
      } else {
        setSessionId(null);
        setPhase("idle");
      }
      return prev;
    });
  }, [stopAudio]);

  const exitSummary = useCallback(() => {
    stopAudio();
    setSessionId(null);
    setPhase("idle");
    setTurns([]);
    setError(null);
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
          rubricScores: data.rubricScores ?? null,
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
    exitSummary,
    submitTurn,
  };
}
