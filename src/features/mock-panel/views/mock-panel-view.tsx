"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { VoiceOrb } from "@/features/speaking-coach/components/voice-orb";
import { SIGNAL_THEME } from "@/lib/signal";
import { pageTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useMockPanel } from "../hooks/use-mock-panel";
import { PanelSeatRail } from "../components/panel-seat-rail";
import { ComposureMeter } from "../components/composure-meter";
import { RecoveryBanner } from "../components/recovery-banner";
import { ReportBody, Deliberating, FailedScreen } from "./mock-report-view";
import { seatLevel, splitPersona, SIGNAL_CSS_VAR } from "../lib/seat-theme";

const SCENARIO_ID = "amzn-bar-raiser-p0";

const LIVE_SHELL_PHASES = new Set([
  "acquiring-mic",
  "creating",
  "connecting",
  "awaiting-session-update",
  "live",
  "handing-off",
  "reminting",
  "reconnecting",
]);

export function MockPanelView({ scenarioId = SCENARIO_ID }: { scenarioId?: string }) {
  const p = useMockPanel();

  const rightAction =
    p.reachedLive && LIVE_SHELL_PHASES.has(p.phase) ? (
      <Button variant="ghost" size="sm" onClick={p.endAndScore}>
        End interview
      </Button>
    ) : (
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard">Leave</Link>
      </Button>
    );

  let body: ReactNode = null;
  if (p.phase === "idle") {
    body = <Intro onStart={() => void p.start(scenarioId)} />;
  } else if (p.phase === "report") {
    // Report can be entered (via adopt / not-renewable-COMPLETED) before the
    // payload is fetched — show the deliberating state, not a blank page.
    body = p.report ? <ReportBody report={p.report} /> : <Deliberating />;
  } else if (p.phase === "wrapping" || p.phase === "debrief-polling") {
    body = <Deliberating />;
  } else if (p.phase === "error" && p.recovery) {
    body =
      p.recovery === "judgment-timeout" || p.recovery === "session-failed" ? (
        <FailedScreen reason={p.recovery === "judgment-timeout" ? "judgment_timeout" : undefined} />
      ) : (
        <div className="py-12">
          <RecoveryBanner
            kind={p.recovery}
            onRetry={p.retryConnect}
            onEndAndScore={p.endAndScore}
            onStartOver={p.startOver}
          />
        </div>
      );
  } else if (LIVE_SHELL_PHASES.has(p.phase)) {
    body = <LiveShell p={p} />;
  }

  return (
    <>
      <PageHeader title="Bar-Raiser Panel" rightAction={rightAction} />
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="mx-auto w-full max-w-5xl p-6 lg:p-12"
      >
        {body}
      </motion.div>
    </>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Amazon Loop — Bar-Raiser Panel
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Three interviewers, each owning different Leadership Principles, plus a Bar
          Raiser who drills your strongest story. Behavioral questions with follow-ups,
          then a committee verdict. Your voice goes straight to the panel — never to our
          servers. We&apos;ll ask for your microphone first.
        </p>
      </div>
      <Button size="lg" onClick={onStart}>
        Start Bar-Raiser panel
      </Button>
    </div>
  );
}

function LiveShell({ p }: { p: ReturnType<typeof useMockPanel> }) {
  const seat = p.seats[p.activeSeatIndex];
  const persona = seat ? splitPersona(seat.personaName) : { name: "", role: "" };
  const tint = SIGNAL_CSS_VAR[seatLevel(p.activeSeatIndex)];
  const activeSpeaker = p.coachResponseInFlight ? "COACH" : p.phase === "live" ? "USER" : null;

  let label = "Connecting the line…";
  let hint = "One moment";
  let dim = false;
  let reactive = false;
  let busy = false;
  if (p.phase === "handing-off") {
    label = "The panel is conferring…";
    hint = "Bringing in the next interviewer";
    dim = true;
  } else if (p.phase === "reconnecting" || p.phase === "reminting") {
    label = "Re-establishing the line…";
    hint = "Hold tight";
  } else if (p.phase === "live" && activeSpeaker === "COACH") {
    label = `${persona.name} is speaking`;
    hint = persona.role;
    busy = true;
  } else if (p.phase === "live") {
    label = "Your turn";
    hint = "Speak naturally — your mic is live";
    reactive = true;
  }

  const seatById = new Map(
    p.seats.map((s, i): [string, { i: number; name: string }] => [
      s.id,
      { i, name: splitPersona(s.personaName).name },
    ])
  );

  return (
    <div className="space-y-10">
      <PanelSeatRail
        seats={p.seats}
        activeSeatIndex={p.activeSeatIndex}
        activeSpeaker={activeSpeaker}
        completedSeatIndexes={p.completedSeatIndexes}
      />

      <VoiceOrb
        levelRef={p.micLevelRef}
        tint={tint}
        label={label}
        hint={hint}
        reactive={reactive}
        busy={busy}
        dim={dim}
      />

      <div className="rounded-lg border bg-card p-5">
        <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Transcript
        </p>
        {p.liveTranscript.length === 0 && !p.coachStreaming ? (
          <p className="text-sm text-muted-foreground/70">
            The first interviewer will begin shortly…
          </p>
        ) : (
          <div className="space-y-3">
            {p.liveTranscript.map((t, i) => (
              <TranscriptLine key={i} role={t.role} seatId={t.seatId} text={t.text} seatById={seatById} />
            ))}
            {p.coachStreaming && (
              <TranscriptLine
                role="COACH"
                seatId={seat?.id ?? null}
                text={p.coachStreaming}
                seatById={seatById}
                streaming
              />
            )}
          </div>
        )}
      </div>

      <ComposureMeter
        running={p.phase === "live"}
        maxDurationSec={p.maxDurationSec}
        bargeIns={p.bargeIns}
      />
    </div>
  );
}

function TranscriptLine({
  role,
  seatId,
  text,
  seatById,
  streaming,
}: {
  role: "USER" | "COACH";
  seatId: string | null;
  text: string;
  seatById: Map<string, { i: number; name: string }>;
  streaming?: boolean;
}) {
  if (role === "USER") {
    return (
      <p className="text-sm leading-relaxed">
        <span className="mr-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">You</span>
        <span className="text-muted-foreground">{text}</span>
      </p>
    );
  }
  const meta = seatId ? seatById.get(seatId) : undefined;
  const tone = meta ? SIGNAL_THEME[seatLevel(meta.i)].text : "text-foreground";
  return (
    <p className="text-sm leading-relaxed">
      <span className={cn("mr-2 font-display text-xs font-semibold tracking-tight", tone)}>
        {meta?.name ?? "Interviewer"}
      </span>
      <span className={cn(streaming && "text-foreground/80")}>
        {text}
        {streaming && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
      </span>
    </p>
  );
}
