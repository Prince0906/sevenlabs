"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { MockReport } from "@sevenlabs/shared-types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { pageTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { InclinationSeal } from "../components/inclination-seal";
import { SeatRollupCard } from "../components/seat-rollup-card";
import { SIGNAL_CSS_VAR } from "../lib/seat-theme";
import * as api from "../lib/mock-api";

/** The verdict body — reused by the live flow and the standalone report route. */
export function ReportBody({ report }: { report: MockReport }) {
  const { verdict } = report;
  const dimensions = [...report.dimensions].sort((a, b) => a.score - b.score);
  const hasConfidence = report.confidence > 0;

  return (
    <div className="space-y-10">
      <InclinationSeal
        overallSignal={verdict.overallSignal}
        inclination={verdict.inclination}
        barRaiserVeto={verdict.barRaiserVeto}
        summary={verdict.summary}
      />

      <SeatRollupCard seatRollup={verdict.seatRollup} />

      {dimensions.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Where you scored — weakest first
          </h2>
          <div className="space-y-3">
            {dimensions.map((d) => (
              <div key={`${d.key}-${d.seatId ?? ""}`} className={cn("space-y-1.5 border-l-2 pl-3", SIGNAL_THEME[d.signalLevel].border)}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{d.key}</p>
                  <span className={cn("shrink-0 text-xs font-medium tabular-nums", SIGNAL_THEME[d.signalLevel].text)}>
                    {SIGNAL_LABEL[d.signalLevel]}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-border">
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{ width: `${d.score}%`, backgroundColor: SIGNAL_CSS_VAR[d.signalLevel] }}
                  />
                </div>
                {d.evidence && (
                  <p className="text-xs italic leading-relaxed text-muted-foreground">“{d.evidence}”</p>
                )}
                {d.gap && <p className="text-xs leading-relaxed">{d.gap}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold tracking-tight">How you held up</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Confidence</p>
            {hasConfidence ? (
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{report.confidence}</p>
            ) : (
              <p className="mt-1 text-2xl text-muted-foreground">—</p>
            )}
          </div>
        </div>
        {!hasConfidence && (
          <p className="text-[11px] text-muted-foreground/70">
            Not enough delivery signal in this session to score composure (live mode has no word-level timing).
          </p>
        )}
      </section>

      {(verdict.topStrengths.length > 0 || verdict.topRisks.length > 0) && (
        <section className="grid gap-6 sm:grid-cols-2">
          <ChipColumn title="Strengths" items={verdict.topStrengths} tone="senior" />
          <ChipColumn title="Risks" items={verdict.topRisks} tone="newgrad" />
        </section>
      )}

      {report.oneRep && (
        <section className="rounded-lg border-l-2 border-foreground bg-accent/40 px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Drill this next</p>
          <p className="mt-1 text-sm font-medium">{report.oneRep.lp}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{report.oneRep.text}</p>
          <Button size="sm" className="mt-3" asChild>
            <Link href="/practice?mode=interview">Drill this next</Link>
          </Button>
        </section>
      )}
    </div>
  );
}

function ChipColumn({ title, items, tone }: { title: string; items: string[]; tone: "senior" | "newgrad" }) {
  const color = tone === "senior" ? "text-signal-senior" : "text-signal-newgrad";
  return (
    <div className="space-y-2">
      <p className={cn("text-[11px] uppercase tracking-[0.08em]", color)}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Standalone report route (/mock/[id]) — polls until COMPLETED or FAILED. */
export function MockReportView({ sessionId }: { sessionId: string }) {
  const [view, setView] = useState<
    { kind: "loading" } | { kind: "debrief" } | { kind: "ready"; report: MockReport } | { kind: "failed"; reason?: string }
  >({ kind: "loading" });
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const r = await api.getReport(sessionId, etagRef.current);
      if (stopped) return;
      if (r.kind === "completed") {
        etagRef.current = r.etag;
        setView({ kind: "ready", report: r.report });
      } else if (r.kind === "failed") {
        setView({ kind: "failed", reason: r.reason });
      } else if (r.kind === "debrief") {
        setView((v) => (v.kind === "ready" ? v : { kind: "debrief" }));
        timer = setTimeout(poll, r.pollAfterMs);
      } else if (r.kind === "error") {
        setView({ kind: "failed" });
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <>
      <PageHeader title="Panel Verdict" />
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="mx-auto w-full max-w-5xl p-6 lg:p-12"
      >
        {view.kind === "ready" ? (
          <ReportBody report={view.report} />
        ) : view.kind === "failed" ? (
          <FailedScreen reason={view.reason} />
        ) : (
          <Deliberating />
        )}
      </motion.div>
    </>
  );
}

export function Deliberating() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex gap-2">
        <span className="size-2.5 animate-pulse rounded-full bg-signal-newgrad" />
        <span className="size-2.5 animate-pulse rounded-full bg-signal-sde2 [animation-delay:150ms]" />
        <span className="size-2.5 animate-pulse rounded-full bg-signal-senior [animation-delay:300ms]" />
      </div>
      <p className="font-display text-lg font-semibold tracking-tight">The panel is deliberating…</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        The interviewers are comparing notes and reaching a committee verdict.
      </p>
    </div>
  );
}

export function FailedScreen({ reason }: { reason?: string }) {
  const timedOut = reason === "judgment_timeout";
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-display text-lg font-semibold tracking-tight">
        {timedOut ? "We couldn't finish scoring" : "This session failed to start"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {timedOut
          ? "Your transcript is saved — try again shortly."
          : "There's nothing to score for this one."}
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/mock">Back to panels</Link>
      </Button>
    </div>
  );
}
