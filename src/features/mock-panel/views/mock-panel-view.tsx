"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SIGNAL_THEME } from "@/lib/signal";
import { pageTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useMockPanel } from "../hooks/use-mock-panel";
import { PanelPresences } from "../components/panel-presences";
import { PanelOrb } from "../components/panel-orb";
import { ComposureMeter } from "../components/composure-meter";
import { RecoveryBanner } from "../components/recovery-banner";
import { ReportBody, Deliberating, FailedScreen } from "./mock-report-view";
import { seatLevel, splitPersona, SIGNAL_CSS_VAR } from "../lib/seat-theme";

const SCENARIO_ID = "react-js-panel-p0";

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
    <div className="panel-stage flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <PageHeader title="React & JavaScript Panel" rightAction={rightAction} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="mx-auto w-full max-w-3xl p-6 lg:p-12"
        >
          {body}
        </motion.div>
      </div>
      {/* Push-to-talk pinned to the bottom of the room, OUTSIDE the scroll area —
          always thumb-reachable no matter how long the transcript grows (the
          2026-06-02 live test flagged the in-flow button as buried). */}
      {p.phase === "live" && (
        <div className="shrink-0 border-t border-border/60 bg-background/85 px-6 py-4 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            <PttControl p={p} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The push-to-talk control. The candidate owns end-of-turn; disabled while the
 * interviewer is speaking — you answer after they finish, as in a real interview. */
function PttControl({ p }: { p: ReturnType<typeof useMockPanel> }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        size="lg"
        onClick={p.toggleCapture}
        disabled={p.coachResponseInFlight}
        variant={p.isCapturing ? "default" : "outline"}
        className="rounded-full px-10"
      >
        {p.isCapturing ? "Done — send to the panel" : "Start answering"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {p.isCapturing
          ? "Take your time — pauses are fine. Tap Done when you've finished."
          : p.coachResponseInFlight
            ? "Listen to the interviewer…"
            : "Tap to answer — you control when your turn ends."}
      </p>
    </div>
  );
}

const INTRO_STEPS: [string, string, string][] = [
  [
    "01",
    "They interview you, in turn",
    "Each interviewer takes the mic in their own voice and presses on the answers that matter.",
  ],
  [
    "02",
    "The Bar Raiser drills deeper",
    "Your strongest claim gets stress-tested by the highest bar in the room.",
  ],
  [
    "03",
    "The committee deliberates",
    "You get a per-interviewer read, the level you reached, and the one rep to run next.",
  ],
];

const TEASER_TINTS = ["var(--signal-newgrad)", "var(--signal-sde2)", "var(--signal-senior)"];

/** The cover — a dim invitation to step into the room. */
export function Intro({ onStart }: { onStart: () => void }) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-10">
      <motion.div variants={staggerItem} className="flex items-center justify-center gap-5 py-2" aria-hidden>
        {TEASER_TINTS.map((tint, i) => (
          <div key={i} className="flex items-center gap-5">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: tint, boxShadow: `0 0 14px color-mix(in oklch, ${tint} 55%, transparent)`, opacity: 0.85 - i * 0.15 }}
            />
            {i < TEASER_TINTS.length - 1 && <span className="h-px w-10 bg-border" />}
          </div>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-5 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--clay-strong)]">
          React / JavaScript · Technical Panel
        </p>
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          Step into the room.
          <br />
          Hear where you really stand.
        </h1>
        <p className="mx-auto max-w-prose text-base leading-relaxed text-muted-foreground">
          Three interviewers — JavaScript fundamentals, React internals, and rendering
          performance — plus a Bar Raiser who drills your strongest area. Conceptual questions
          with real follow-ups, then a committee verdict, not a number.
        </p>
      </motion.div>

      <motion.ol variants={staggerItem} className="mx-auto max-w-prose space-y-4 border-t border-border pt-6">
        {INTRO_STEPS.map(([n, t, d]) => (
          <li key={n} className="flex gap-4">
            <span className="font-display text-base font-semibold tabular-nums text-[var(--clay-strong)]">
              {n}
            </span>
            <div>
              <p className="text-[15px] font-semibold">{t}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </motion.ol>

      <motion.div variants={staggerItem} className="flex flex-col items-center gap-3 text-center">
        <Button size="lg" onClick={onStart}>
          Start the panel
        </Button>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          We&apos;ll ask for your microphone first. A recording of each answer is sent to our
          servers to score your delivery, then discarded.
        </p>
      </motion.div>
    </motion.div>
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
    label = "The panel is conferring";
    hint = "Bringing in the next interviewer";
    dim = true;
  } else if (p.phase === "reconnecting" || p.phase === "reminting") {
    label = "Re-establishing the line…";
    hint = "Hold tight";
  } else if (p.phase === "live" && activeSpeaker === "COACH") {
    label = `${persona.name} is speaking`;
    hint = persona.role || "Interviewer";
    busy = true;
  } else if (p.phase === "live" && p.isCapturing) {
    // Push-to-talk: the candidate's mic is open. The orb reacts; nothing ends the
    // turn until they tap Done, so pauses to think are completely safe.
    label = "Listening…";
    hint = "Take your time — tap Done when you've finished";
    reactive = true;
  } else if (p.phase === "live" && p.committedTurns === 0) {
    // Opening beat: the interviewer speaks first. Don't tell the candidate it's
    // "your turn" while we're still waiting for the panel's first question.
    label = "The interviewer will begin shortly…";
    hint = "Listen for the first question";
    dim = true;
  } else if (p.phase === "live") {
    label = "Your turn";
    hint = "Tap “Start answering” when you're ready";
  }

  const seatById = new Map(
    p.seats.map((s, i): [string, { i: number; name: string }] => [
      s.id,
      { i, name: splitPersona(s.personaName).name },
    ])
  );

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-10">
      <motion.div variants={staggerItem}>
        <PanelPresences
          seats={p.seats}
          activeSeatIndex={p.activeSeatIndex}
          activeSpeaker={activeSpeaker}
          completedSeatIndexes={p.completedSeatIndexes}
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <PanelOrb
          levelRef={p.micLevelRef}
          tint={tint}
          label={label}
          hint={hint}
          reactive={reactive}
          busy={busy}
          dim={dim}
        />
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Transcript
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        {p.liveTranscript.length === 0 && !p.coachStreaming ? (
          <p className="font-display text-base italic text-muted-foreground/70">
            The first interviewer will begin shortly…
          </p>
        ) : (
          <div className="space-y-5">
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
      </motion.div>

      <motion.div variants={staggerItem}>
        <ComposureMeter
          running={p.phase === "live"}
          maxDurationSec={p.maxDurationSec}
          bargeIns={p.bargeIns}
        />
      </motion.div>
    </motion.div>
  );
}

/** Interviewer dialogue is set in Fraunces (serif, left-ruled, named in the
 * seat's glowing color) like a play; the candidate's lines are quieter sans —
 * the contrast is the editorial "real evaluators" signal. */
export function TranscriptLine({
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
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">You</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/80">{text}</p>
      </div>
    );
  }
  const meta = seatId ? seatById.get(seatId) : undefined;
  const tone = meta ? SIGNAL_THEME[seatLevel(meta.i)].text : "text-foreground";
  return (
    <div className="border-l-2 border-border pl-4">
      <p className={cn("font-display text-[13px] font-semibold uppercase tracking-[0.1em]", tone)}>
        {meta?.name ?? "Interviewer"}
      </p>
      <p
        className={cn(
          "mt-1.5 font-display text-lg leading-relaxed",
          streaming ? "text-foreground/80" : "text-foreground"
        )}
      >
        {text}
        {streaming && <span className="ml-0.5 inline-block animate-pulse text-[var(--clay)]">▍</span>}
      </p>
    </div>
  );
}
