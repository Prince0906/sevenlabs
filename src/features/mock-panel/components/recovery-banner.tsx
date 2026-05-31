"use client";

import { AlertTriangle, MicOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecoveryKind } from "../lib/panel-machine";

interface RecoveryBannerProps {
  kind: RecoveryKind;
  onRetry?: () => void;
  onEndAndScore?: () => void;
  onStartOver?: () => void;
}

type Cta = "retry" | "end" | "over";

const CONFIG: Record<RecoveryKind, { title: string; body: string; tone: "warn" | "error"; cta: Cta }> = {
  "mic-denied": {
    title: "Microphone needed",
    body: "Allow mic access to begin — your audio goes straight to the interviewer, never to our servers.",
    tone: "warn",
    cta: "retry",
  },
  "already-live": {
    title: "A session is already live",
    body: "You have a panel running elsewhere. Finish or close it, then try again.",
    tone: "warn",
    cta: "retry",
  },
  capacity: {
    title: "At capacity",
    body: "We're at capacity right now. Try again in a moment.",
    tone: "warn",
    cta: "retry",
  },
  "rate-limited": {
    title: "Too many attempts",
    body: "Give it a few seconds, then try again.",
    tone: "warn",
    cta: "retry",
  },
  "voice-unavailable": {
    title: "Voice unavailable",
    body: "The interviewer's voice couldn't connect. Try again.",
    tone: "warn",
    cta: "retry",
  },
  disconnected: {
    title: "Connection lost",
    body: "We couldn't re-establish the line. You can score what you've done so far.",
    tone: "error",
    cta: "end",
  },
  "not-startable": {
    title: "Nothing to score yet",
    body: "This session didn't get going. Start a fresh panel.",
    tone: "error",
    cta: "over",
  },
  "judgment-timeout": {
    title: "Scoring timed out",
    body: "We couldn't finish scoring in time — your transcript is saved. Try again shortly.",
    tone: "error",
    cta: "over",
  },
  "session-failed": {
    title: "Session failed to start",
    body: "There's nothing to score for this one. Start over when you're ready.",
    tone: "error",
    cta: "over",
  },
};

export function RecoveryBanner({ kind, onRetry, onEndAndScore, onStartOver }: RecoveryBannerProps) {
  const c = CONFIG[kind];
  const Icon = kind === "mic-denied" ? MicOff : AlertTriangle;
  const handler = c.cta === "retry" ? onRetry : c.cta === "end" ? onEndAndScore : onStartOver;
  const ctaLabel = c.cta === "retry" ? "Try again" : c.cta === "end" ? "End and score" : "Start over";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-4",
        c.tone === "error" ? "border-destructive/40" : "border-border"
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", c.tone === "error" ? "text-destructive" : "text-[var(--clay-strong)]")} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold tracking-tight">{c.title}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{c.body}</p>
      </div>
      {handler && (
        <Button variant="outline" size="sm" onClick={handler} className="shrink-0">
          <RotateCcw className="size-3.5" />
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
