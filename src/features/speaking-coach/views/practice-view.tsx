"use client";

import { useCallback, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { PracticeVad } from "../components/practice-vad";
import { MetricsPanel } from "../components/metrics-panel";
import { usePracticeSession } from "../hooks/use-practice-session";
import { Mic } from "lucide-react";
import Link from "next/link";

const phaseLabel: Record<string, string> = {
  idle: "Ready to start",
  "coach-speaking": "Coach is speaking…",
  "your-turn": "Your turn — start speaking",
  listening: "Listening…",
  analyzing: "Analyzing your answer…",
};

export function PracticeView() {
  const clientTurnPrefix = useId();
  const turnCounter = useRef(0);

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
    submitTurn,
  } = usePracticeSession();

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
      await startSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-4">
        <PageHeader title="Speaking practice" className="border-0 px-0 py-0" />
        <Button variant="outline" asChild>
          <Link href="/practice/history">Session history</Link>
        </Button>
      </div>
      <p className="px-6 text-sm text-muted-foreground -mt-4">
        Turn-based delivery coaching — pace, pauses, and fillers.
      </p>

      <PracticeVad
        enabled={vadEnabled && Boolean(sessionId)}
        onSpeechStart={handleSpeechStart}
        onSpeechEnd={handleSpeechEnd}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {phase === "analyzing" ? (
              <Spinner className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
            {phaseLabel[phase] ?? phase}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {phase === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">{openingCoachText || "Start a session to hear your coach and practice interview answers."}</p>
              <Button onClick={handleStart} disabled={starting}>
                {starting && <Spinner className="mr-2 size-4" />}
                {starting ? "Starting..." : "Start practice"}
              </Button>
            </>
          )}
          {sessionId && phase !== "idle" && (
            <p className="text-xs text-muted-foreground">Session {sessionId}</p>
          )}
        </CardContent>
      </Card>

      {turns.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {turns.map((t, i) => (
            <div key={t.clientTurnId} className="space-y-2">
              <MetricsPanel metrics={t.metrics} transcript={t.transcript} />
              <Card>
                <CardContent className="pt-4 text-sm">
                  <p className="font-medium text-muted-foreground mb-1">
                    Coach — turn {i + 1}
                  </p>
                  <p>{t.coachText}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
