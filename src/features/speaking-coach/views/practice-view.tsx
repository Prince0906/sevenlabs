"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { PracticeVad } from "../components/practice-vad";
import { MetricsPanel } from "../components/metrics-panel";
import { usePracticeSession } from "../hooks/use-practice-session";
import {
  Mic,
  MicOff,
  BrainCircuit,
  MessageSquare,
  History,
  Briefcase,
  Rocket,
  Presentation,
  AudioWaveform,
  ArrowRight,
  Square,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

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

interface ModeOption {
  mode: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "interview",
    title: "Job Interview",
    description: "Practice behavioral and technical questions with delivery coaching",
    icon: Briefcase,
    gradient: "from-violet-500/10 to-violet-500/5",
  },
  {
    mode: "pitch",
    title: "Pitch",
    description: "Sharpen your startup or project pitch — timing, clarity, and energy",
    icon: Rocket,
    gradient: "from-pink-500/10 to-pink-500/5",
  },
  {
    mode: "presentation",
    title: "Presentation",
    description: "Work on pacing, vocal variety, and audience engagement",
    icon: Presentation,
    gradient: "from-orange-500/10 to-orange-500/5",
  },
  {
    mode: "delivery",
    title: "General Delivery",
    description: "Open-ended practice — pace, pauses, and filler words",
    icon: AudioWaveform,
    gradient: "from-emerald-500/10 to-emerald-500/5",
  },
];

const MODE_LABELS: Record<string, string> = {
  interview: "Interview",
  pitch: "Pitch",
  presentation: "Presentation",
  delivery: "Delivery",
};

export function PracticeView() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get("mode");

  const clientTurnPrefix = useId();
  const turnCounter = useRef(0);
  const [selectedMode, setSelectedMode] = useState<string | null>(urlMode);

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
      await startSession(selectedMode ?? "delivery");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    }
  };

  const handleStop = () => {
    stopSession();
    turnCounter.current = 0;
  };

  const showModeSelector = !selectedMode && phase === "idle" && !sessionId;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Speaking practice" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">

          {/* Mode selector */}
          {showModeSelector && (
            <>
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold tracking-tight">
                  What would you like to practice?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose a mode to get coaching tailored to your goal.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => setSelectedMode(opt.mode)}
                    className={cn(
                      "group flex items-start gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:bg-accent/50 hover:shadow-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br",
                        opt.gradient
                      )}
                    >
                      <opt.icon className="size-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{opt.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Phase indicator — shown once mode is selected */}
          {selectedMode && (
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
                          : "Listen to the coach, then it's your turn"}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {MODE_LABELS[selectedMode] ?? selectedMode}
                </Badge>
                {sessionId && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Turn {turns.length}
                  </Badge>
                )}
                {sessionId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                  >
                    <Square className="size-3.5" />
                    Stop
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/practice/history">
                    <History className="size-4" />
                    <span className="hidden sm:inline">History</span>
                  </Link>
                </Button>
              </div>
            </div>
          )}

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

          {/* Idle hero card — shown when mode is selected but session not started */}
          {selectedMode && phase === "idle" && !sessionId && (
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
                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMode(null)}
                    >
                      Change mode
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleStart}
                      disabled={starting}
                    >
                      {starting && <Spinner className="mr-2 size-4" />}
                      {starting ? "Starting session..." : "Start practice session"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Phase banner — clear instruction for what to do now */}
          {sessionId && phase === "coach-speaking" && (
            <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
              <MessageSquare className="size-5 text-violet-500 shrink-0" />
              <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
                Coach is speaking — listen to the feedback before your next turn
              </p>
            </div>
          )}
          {sessionId && (phase === "your-turn" || phase === "listening") && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
              <Mic className="size-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {phase === "listening"
                  ? "Listening... keep speaking, I'll wait for you to finish"
                  : "Your turn — speak when you're ready, your mic is active"}
              </p>
            </div>
          )}
          {sessionId && phase === "analyzing" && (
            <div className="flex items-center gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 dark:border-cyan-800 dark:bg-cyan-950/30">
              <Spinner className="size-4 text-cyan-500 shrink-0" />
              <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                Analyzing your delivery — hang tight...
              </p>
            </div>
          )}

          {/* Active session — coach opening message */}
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
