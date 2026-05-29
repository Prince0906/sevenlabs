"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import type { SignalLevel } from "@sevenlabs/shared-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { pageTransition } from "@/lib/motion";
import { PracticeVad } from "../components/practice-vad";
import { MetricsPanel } from "../components/metrics-panel";
import { RubricScoreBlock } from "../components/rubric-score-block";
import { SessionResults } from "../components/session-results";
import { usePracticeSession } from "../hooks/use-practice-session";
import { VoiceOrb } from "../components/voice-orb";
import { History } from "lucide-react";
import Link from "next/link";

const MODE_OPTIONS = [
  {
    mode: "interview",
    title: "Interview",
    description: "Behavioral practice scored by Amazon Leadership Principles.",
  },
  {
    mode: "pitch",
    title: "Pitch",
    description: "Sharpen timing, clarity, and energy for a short pitch.",
  },
  {
    mode: "presentation",
    title: "Presentation",
    description: "Pacing, vocal variety, and audience engagement.",
  },
  {
    mode: "delivery",
    title: "Free practice",
    description: "Open-ended delivery — pace, pauses, and fillers.",
  },
];

const MODE_LABELS: Record<string, string> = {
  interview: "Interview",
  pitch: "Pitch",
  presentation: "Presentation",
  delivery: "Free practice",
};

export function PracticeView() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get("mode");
  const drillLP = searchParams.get("drillLP");

  const clientTurnPrefix = useId();
  const turnCounter = useRef(0);
  const levelRef = useRef(0);
  const [selectedMode, setSelectedMode] = useState<string | null>(
    drillLP ? "interview" : urlMode
  );

  const {
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
  } = usePracticeSession();

  const [summaryContext, setSummaryContext] = useState<{
    streakDays: number;
    previousSignal: SignalLevel | null;
  } | null>(null);
  const transcriptReviewRef = useRef<HTMLDivElement | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (phase !== "summary") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/cockpit");
        if (!res.ok) return;
        const data = (await res.json()) as {
          streakDays: number;
          signal: { previous: SignalLevel | null };
        };
        if (cancelled) return;
        setSummaryContext({
          streakDays: data.streakDays,
          previousSignal: data.signal.previous,
        });
      } catch {
        // best-effort — leave context null
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const vadEnabled = phase === "your-turn" || phase === "listening";

  const handleSpeechStart = useCallback(() => {
    setPhase("listening");
  }, [setPhase]);

  const handleSpeechEnd = useCallback(
    async (audio: Blob) => {
      turnCounter.current += 1;
      const clientTurnId = `${clientTurnPrefix}-${turnCounter.current}`;
      try {
        await submitTurn(clientTurnId, audio);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Turn failed");
        setPhase("your-turn");
      }
    },
    [clientTurnPrefix, submitTurn, setError, setPhase]
  );

  const handleStart = async () => {
    try {
      await startSession(selectedMode ?? "delivery");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  };

  const handleStop = () => {
    stopSession();
  };

  const handleDrillAgain = async () => {
    const modeToReuse = selectedMode ?? "interview";
    turnCounter.current = 0;
    setSummaryContext(null);
    setShowReview(false);
    exitSummary();
    try {
      await startSession(modeToReuse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  };

  const handleReviewTranscript = () => {
    setShowReview(true);
    requestAnimationFrame(() => {
      transcriptReviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleExitSummary = () => {
    turnCounter.current = 0;
    setSummaryContext(null);
    setShowReview(false);
    exitSummary();
    setSelectedMode(null);
  };

  const showModeSelector = !selectedMode && phase === "idle" && !sessionId;
  const isSummary = phase === "summary";

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Practice" />

      <div className="flex-1 overflow-y-auto">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="mx-auto max-w-3xl space-y-8 p-6 lg:p-10"
        >
          {showModeSelector && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Start a session
                </p>
                <h2 className="font-display text-2xl font-semibold tracking-tight">
                  What would you like to practice?
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => setSelectedMode(opt.mode)}
                    className="group flex flex-col gap-2 rounded-lg border bg-card p-5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="text-sm font-medium">{opt.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {opt.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedMode && !isSummary && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {MODE_LABELS[selectedMode] ?? selectedMode}
                </Badge>
                {drillLP && (
                  <Badge variant="outline" className="text-[10px]">
                    {drillLP}
                  </Badge>
                )}
                {sessionId && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Turn {turns.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {sessionId && (
                  <Button variant="outline" size="sm" onClick={handleStop}>
                    Stop
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/practice/history">
                    <History className="size-4" />
                    <span className="hidden sm:inline">History</span>
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <PracticeVad
            enabled={vadEnabled && Boolean(sessionId)}
            onSpeechStart={handleSpeechStart}
            onSpeechEnd={handleSpeechEnd}
            onAudioLevel={(l) => {
              levelRef.current = l;
            }}
          />

          {sessionId && phase !== "idle" && !isSummary && (
            <VoiceOrb phase={phase} levelRef={levelRef} />
          )}

          {isSummary && (
            <>
              <SessionResults
                turns={turns}
                streakDays={summaryContext?.streakDays}
                previousSignal={summaryContext?.previousSignal ?? null}
                onDrillAgain={handleDrillAgain}
                onReviewTranscript={
                  turns.length > 0 ? handleReviewTranscript : undefined
                }
              />
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={handleExitSummary}>
                  Back to practice menu
                </Button>
              </div>
              {showReview && (
                <div
                  ref={transcriptReviewRef}
                  className="flex items-center justify-between border-t pt-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Turn-by-turn
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReview(false)}
                  >
                    Hide
                  </Button>
                </div>
              )}
            </>
          )}

          {selectedMode && phase === "idle" && !sessionId && (
            <div className="rounded-lg border bg-card p-6 lg:p-8">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {MODE_LABELS[selectedMode] ?? selectedMode}
                  </p>
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    Ready to practice?
                  </h2>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {openingCoachText ||
                      "Start a session to get real-time feedback on your pace, pauses, filler words, and overall delivery."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button onClick={handleStart} disabled={starting}>
                    {starting && <Spinner className="mr-2 size-4" />}
                    {starting ? "Starting" : "Start session"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMode(null)}
                  >
                    Change mode
                  </Button>
                </div>
              </div>
            </div>
          )}

          {sessionId && phase !== "idle" && !isSummary && turns.length === 0 && (
            <div className="rounded-lg border bg-card p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Coach
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                {openingCoachText || "Waiting for you to speak…"}
              </p>
            </div>
          )}

          {turns.length > 0 && (!isSummary || showReview) && (
            <div className="space-y-6">
              {!isSummary && (
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Session
                </p>
              )}
              {turns.map((t, i) => (
                <div
                  key={t.clientTurnId}
                  className="space-y-4 rounded-lg border bg-card p-5 lg:p-6"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Turn {i + 1}
                    </p>
                  </div>

                  <MetricsPanel metrics={t.metrics} transcript={t.transcript} />

                  <div className="border-t pt-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Coach
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                      {t.coachText}
                    </p>
                  </div>

                  {t.rubricScores && (
                    <RubricScoreBlock rubricScores={t.rubricScores} />
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
