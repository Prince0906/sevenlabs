"use client";

import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type {
  MatchedLP,
  RubricScores,
  SignalLevel,
  SpeechMetrics,
} from "@sevenlabs/shared-types";
import { Button } from "@/components/ui/button";
import { pageTransition, pulseOnIncrement } from "@/lib/motion";
import { SignalPointer } from "./signal-pointer";
import { LPMasteryCard } from "./lp-mastery-card";
import { ShareableSignalCard } from "./shareable-signal-card";
import { SIGNAL_LABEL, SIGNAL_RANK, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";

interface SessionTurn {
  metrics: SpeechMetrics | null;
  rubricScores: RubricScores | null;
}

interface SessionResultsProps {
  turns: SessionTurn[];
  streakDays?: number;
  previousSignal?: SignalLevel | null;
  onDrillAgain?: () => void;
  onReviewTranscript?: () => void;
}

export function SessionResults({
  turns,
  streakDays,
  previousSignal,
  onDrillAgain,
  onReviewTranscript,
}: SessionResultsProps) {
  const aggregate = useMemo(() => aggregateTurns(turns), [turns]);

  const signalImproved =
    aggregate.overallSignal &&
    previousSignal &&
    SIGNAL_RANK[aggregate.overallSignal] > SIGNAL_RANK[previousSignal];

  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    const node = cardRef.current;
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "aloud-signal.png";
      link.click();
    } catch {
      toast.error("Couldn't generate the image — try a screenshot instead.");
    }
  };

  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {aggregate.overallSignal && (
        <div className="space-y-3">
          {signalImproved && previousSignal && (
            <motion.p
              variants={pulseOnIncrement}
              initial="initial"
              animate="animate"
              className="text-center text-sm font-medium text-success"
            >
              ↑ You leveled up — {SIGNAL_LABEL[previousSignal]} →{" "}
              {SIGNAL_LABEL[aggregate.overallSignal]}
            </motion.p>
          )}
          <div className="flex justify-center">
            <ShareableSignalCard
              ref={cardRef}
              signal={aggregate.overallSignal}
              topLP={aggregate.matchedLPs[0] ?? null}
              weakestArea={aggregate.weakestArea}
            />
          </div>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-4" />
              Download image
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Session complete
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {aggregate.turnCount} {aggregate.turnCount === 1 ? "turn" : "turns"}
          </p>
        </div>

        <div className="space-y-3 px-6 py-7 lg:px-10 lg:py-9">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Signal
          </p>
          <p
            className={cn(
              "font-display text-4xl font-semibold tracking-tight lg:text-5xl",
              aggregate.overallSignal &&
                SIGNAL_THEME[aggregate.overallSignal].text
            )}
          >
            {aggregate.overallSignal
              ? SIGNAL_LABEL[aggregate.overallSignal]
              : "—"}
          </p>
          {aggregate.overallSignal ? (
            signalImproved && previousSignal ? (
              <p className="text-sm font-medium text-success">
                ↑ Up from {SIGNAL_LABEL[previousSignal]}
              </p>
            ) : previousSignal ? (
              <p className="text-sm text-muted-foreground">
                Last session {SIGNAL_LABEL[previousSignal]}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Your latest signal</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Practice in interview mode to receive a leadership signal.
            </p>
          )}
          {aggregate.overallSignal && (
            <div className="pt-4">
              <SignalPointer
                current={aggregate.overallSignal}
                previous={previousSignal ?? null}
              />
            </div>
          )}
        </div>

        {aggregate.matchedLPs.length > 0 && (
          <div className="space-y-4 border-t px-6 py-6 lg:px-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Leadership Principles
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {aggregate.matchedLPs.map((lp) => (
                <LPMasteryCard key={lp.name} lp={lp} />
              ))}
            </div>
          </div>
        )}

        {aggregate.weakestArea && (
          <div className="space-y-2 border-t px-6 py-6 lg:px-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Level up next
            </p>
            <p className="text-sm leading-relaxed">
              {aggregate.weakestArea}
            </p>
          </div>
        )}

        {aggregate.delivery && (
          <div className="space-y-3 border-t px-6 py-6 lg:px-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Delivery
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <span className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Pace</p>
                <p className="font-medium tabular-nums">
                  {aggregate.delivery.meanWpm} wpm
                </p>
              </span>
              <span className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Fillers</p>
                <p className="font-medium tabular-nums">
                  {aggregate.delivery.totalFillers}
                </p>
              </span>
              <span className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Avg pause</p>
                <p className="font-medium tabular-nums">
                  {aggregate.delivery.meanAvgPauseMs} ms
                </p>
              </span>
              <span className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium tabular-nums">
                  {Math.round(aggregate.delivery.totalDurationSec)}s
                </p>
              </span>
            </div>
          </div>
        )}

        {((streakDays !== undefined && streakDays > 0) ||
          aggregate.seniorLPCount > 0) && (
          <div className="border-t px-6 py-4 lg:px-10">
            <p className="text-xs text-muted-foreground">
              {streakDays !== undefined && streakDays > 0 && (
                <span>
                  {streakDays}-day streak
                </span>
              )}
              {streakDays !== undefined && streakDays > 0 &&
                aggregate.seniorLPCount > 0 && <span> · </span>}
              {aggregate.seniorLPCount > 0 && (
                <span>
                  {aggregate.seniorLPCount}{" "}
                  {aggregate.seniorLPCount === 1 ? "LP" : "LPs"} at Senior
                </span>
              )}
            </p>
          </div>
        )}

        {(onReviewTranscript || onDrillAgain) && (
          <div className="flex flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end lg:px-10">
            {onReviewTranscript && (
              <Button variant="outline" onClick={onReviewTranscript}>
                Review transcript
              </Button>
            )}
            {onDrillAgain && (
              <Button onClick={onDrillAgain}>Drill again</Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface AggregateResult {
  overallSignal: SignalLevel | null;
  matchedLPs: MatchedLP[];
  weakestArea: string | null;
  delivery: {
    meanWpm: number;
    totalFillers: number;
    meanAvgPauseMs: number;
    totalDurationSec: number;
  } | null;
  turnCount: number;
  seniorLPCount: number;
}

function aggregateTurns(turns: SessionTurn[]): AggregateResult {
  const scored = turns.filter(
    (t): t is SessionTurn & { rubricScores: RubricScores } =>
      Boolean(t.rubricScores)
  );

  const lpMap = new Map<string, MatchedLP>();
  for (const t of scored) {
    for (const lp of t.rubricScores.matchedLPs) {
      const existing = lpMap.get(lp.name);
      if (
        !existing ||
        SIGNAL_RANK[lp.signalLevel] > SIGNAL_RANK[existing.signalLevel]
      ) {
        lpMap.set(lp.name, lp);
      }
    }
  }

  const matchedLPs = Array.from(lpMap.values()).sort(
    (a, b) => SIGNAL_RANK[b.signalLevel] - SIGNAL_RANK[a.signalLevel]
  );

  const overallSignal =
    scored.length > 0 ? scored[scored.length - 1]!.rubricScores.overallSignal : null;
  const weakestArea =
    scored.length > 0 ? scored[scored.length - 1]!.rubricScores.weakestArea : null;

  const turnsWithMetrics = turns.filter(
    (t): t is SessionTurn & { metrics: SpeechMetrics } => Boolean(t.metrics)
  );
  const delivery =
    turnsWithMetrics.length > 0
      ? {
          meanWpm: Math.round(
            turnsWithMetrics.reduce((s, t) => s + t.metrics.wpm, 0) /
              turnsWithMetrics.length
          ),
          totalFillers: turnsWithMetrics.reduce(
            (s, t) => s + t.metrics.fillerCount,
            0
          ),
          meanAvgPauseMs: Math.round(
            turnsWithMetrics.reduce((s, t) => s + t.metrics.avgPauseMs, 0) /
              turnsWithMetrics.length
          ),
          totalDurationSec: turnsWithMetrics.reduce(
            (s, t) => s + t.metrics.turnDurationSec,
            0
          ),
        }
      : null;

  return {
    overallSignal,
    matchedLPs,
    weakestArea,
    delivery,
    turnCount: turns.length,
    seniorLPCount: matchedLPs.filter((lp) => lp.signalLevel === "SENIOR").length,
  };
}
