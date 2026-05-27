"use client";

import { useCallback, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { PracticeVad } from "../components/practice-vad";
import { MetricsPanel } from "../components/metrics-panel";
import { usePracticeSession } from "../hooks/use-practice-session";
import { Mic, MicOff, BrainCircuit, MessageSquare, History } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const phaseConfig: Record<
  string,
  { label: string; color: string; icon: typeof Mic; pulse: boolean }
> = {
  idle: { label: "Ready to start", color: "bg-muted", icon: MicOff, pulse: false },
  "coach-speaking": { label: "Coach is speaking", color: "bg-violet-500", icon: MessageSquare, pulse: true },
  "your-turn": { label: "Your turn", color: "bg-emerald-500", icon: Mic, pulse: true },
  listening: { label: "Listening", color: "bg-emerald-500", icon: Mic, pulse: true },
  analyzing: { label: "Analyzing", color: "bg-cyan-500", icon: BrainCircuit, pulse: true },
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
  const config = phaseConfig[phase] ?? phaseConfig.idle;
  const PhaseIcon = config.icon;

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
    <div className="flex flex-1 flex-col">
      <PageHeader title="Speaking practice" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
          {/* Phase indicator */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-white",
                  config.color
                )}
              >
                <PhaseIcon className="size-5" />
              </div>
              {config.pulse && (
                <span
                  className={cn(
                    "absolute inset-0 animate-ping rounded-full opacity-30",
                    config.color
                  )}
                />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">
                {phase === "idle"
                  ? "Click start to begin a coaching session"
                  : phase === "your-turn"
                    ? "Speak naturally — your mic is active"
                    : phase === "listening"
                      ? "Recording your speech..."
                      : phase === "analyzing"
                        ? "Processing your delivery metrics..."
                        : "Listen to your coach's feedback"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {sessionId && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  Turn {turns.length}
                </Badge>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/practice/history">
                  <History className="size-4" />
                  <span className="hidden sm:inline">History</span>
                </Link>
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <PracticeVad
            enabled={vadEnabled && Boolean(sessionId)}
            onSpeechStart={handleSpeechStart}
            onSpeechEnd={handleSpeechEnd}
          />

          {/* Coach card */}
          {phase === "idle" && (
            <Card className="overflow-hidden">
              <div className="bg-linear-to-br from-violet-500/10 via-transparent to-cyan-500/10 p-6 lg:p-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Mic className="size-8 text-violet-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">
                      Ready to practice?
                    </h2>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      {openingCoachText ||
                        "Start a session to get real-time feedback on your pace, pauses, filler words, and overall delivery."}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleStart}
                    disabled={starting}
                    className="mt-2"
                  >
                    {starting && <Spinner className="mr-2 size-4" />}
                    {starting ? "Starting session..." : "Start practice session"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Active session — coach speaking or waiting */}
          {sessionId && phase !== "idle" && turns.length === 0 && (
            <Card>
              <CardContent className="flex items-center gap-4 py-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                  <MessageSquare className="size-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Coach</p>
                  <p className="text-sm text-muted-foreground">
                    {openingCoachText || "Waiting for you to speak..."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Turn results */}
          {turns.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-muted-foreground">
                Session results
              </h3>
              {turns.map((t, i) => (
                <div
                  key={t.clientTurnId}
                  className="space-y-3 rounded-xl border bg-card p-4 lg:p-6"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Turn {i + 1}
                    </Badge>
                  </div>

                  <MetricsPanel metrics={t.metrics} transcript={t.transcript} />

                  {/* Coach feedback */}
                  <div className="flex gap-3 rounded-lg bg-violet-500/5 p-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                      <MessageSquare className="size-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                        Coach feedback
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        {t.coachText}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
