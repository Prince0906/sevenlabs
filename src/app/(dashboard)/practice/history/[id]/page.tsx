"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { AudioPlayer } from "@/components/audio-player";
import type {
  RubricScores,
  SpeechMetrics,
} from "@sevenlabs/shared-types";
import { rubricScoresSchema, speechMetricsSchema } from "@sevenlabs/shared-types";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";
import { pageTransition } from "@/lib/motion";
import { MetricsPanel } from "@/features/speaking-coach/components/metrics-panel";
import { RubricScoreBlock } from "@/features/speaking-coach/components/rubric-score-block";
import { SessionResults } from "@/features/speaking-coach/components/session-results";

interface RawTurn {
  id: string;
  role: string;
  transcript: string | null;
  coachText: string | null;
  metricsJson: unknown;
  rubricScoresJson: unknown;
  audioUrl: string | null;
  createdAt: string;
}

function parseMetrics(json: unknown): SpeechMetrics | null {
  if (!json) return null;
  const r = speechMetricsSchema.safeParse(json);
  return r.success ? r.data : null;
}

function parseRubric(json: unknown): RubricScores | null {
  if (!json) return null;
  const r = rubricScoresSchema.safeParse(json);
  return r.success ? r.data : null;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rawTurns, setRawTurns] = useState<RawTurn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/coach/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => setRawTurns(d.turns ?? []))
      .finally(() => setLoading(false));
  }, [id]);

  const userTurnNumbers = new Map<string, number>();
  let counter = 0;
  for (const t of rawTurns) {
    if (t.role === "USER") {
      counter += 1;
      userTurnNumbers.set(t.id, counter);
    }
  }

  const summaryTurns = useMemo(
    () =>
      rawTurns
        .filter((t) => t.role === "USER")
        .map((t) => ({
          metrics: parseMetrics(t.metricsJson),
          rubricScores: parseRubric(t.rubricScoresJson),
        })),
    [rawTurns]
  );

  const hasRubricData = summaryTurns.some((t) => t.rubricScores);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Session detail" />

      <div className="flex-1 overflow-y-auto">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="mx-auto max-w-3xl space-y-8 p-6 lg:p-10"
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="size-6" />
            </div>
          ) : rawTurns.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              No turns found for this session.
            </p>
          ) : (
            <>
              {hasRubricData && <SessionResults turns={summaryTurns} />}

              <div className="space-y-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Turn-by-turn
                </p>
                <div className="space-y-4">
                  {rawTurns.map((t) => {
                    if (t.role === "USER") {
                      const metrics = parseMetrics(t.metricsJson);
                      const rubric = parseRubric(t.rubricScoresJson);
                      return (
                        <div
                          key={t.id}
                          className="space-y-4 rounded-lg border bg-card p-5 lg:p-6"
                        >
                          <div className="flex items-baseline justify-between">
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              You · Turn {userTurnNumbers.get(t.id)}
                            </p>
                          </div>
                          {t.audioUrl && (
                            <AudioPlayer src={t.audioUrl} label="Your answer" />
                          )}
                          <MetricsPanel
                            metrics={metrics}
                            transcript={t.transcript ?? ""}
                          />
                          {rubric && <RubricScoreBlock rubricScores={rubric} />}
                        </div>
                      );
                    }

                    if (t.role === "COACH") {
                      return (
                        <div
                          key={t.id}
                          className="space-y-3 rounded-lg border bg-card p-5 lg:p-6"
                        >
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            Coach
                          </p>
                          {t.coachText && (
                            <p className="text-sm leading-relaxed">
                              {t.coachText}
                            </p>
                          )}
                          {t.audioUrl && (
                            <AudioPlayer src={t.audioUrl} label="Coach audio" />
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
