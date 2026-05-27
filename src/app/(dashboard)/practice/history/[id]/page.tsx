"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { MetricsPanel } from "@/features/speaking-coach/components/metrics-panel";
import { MessageSquare, Mic, Volume2 } from "lucide-react";
import type { SpeechMetrics } from "@sevenlabs/shared-types";

interface Turn {
  id: string;
  role: string;
  transcript: string | null;
  coachText: string | null;
  metricsJson: SpeechMetrics | null;
  audioUrl: string | null;
  createdAt: string;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/coach/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => setTurns(d.turns ?? []))
      .finally(() => setLoading(false));
  }, [id]);

  const userTurnNumbers = new Map<string, number>();
  let counter = 0;
  for (const t of turns) {
    if (t.role === "USER") {
      counter += 1;
      userTurnNumbers.set(t.id, counter);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Session detail" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="size-6" />
            </div>
          ) : turns.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              No turns found for this session.
            </p>
          ) : (
            <div className="space-y-4">
              {turns.map((t) => {
                if (t.role === "USER") {
                  return (
                    <div
                      key={t.id}
                      className="space-y-3 rounded-xl border bg-card p-4 lg:p-6"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
                          <Mic className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-sm font-medium">You</span>
                        <Badge variant="secondary" className="text-[10px]">
                          Turn {userTurnNumbers.get(t.id)}
                        </Badge>
                      </div>
                      <MetricsPanel
                        metrics={t.metricsJson}
                        transcript={t.transcript ?? ""}
                      />
                    </div>
                  );
                }

                if (t.role === "COACH") {
                  return (
                    <div
                      key={t.id}
                      className="flex gap-3 rounded-xl bg-violet-500/5 p-4 lg:p-6"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                        <MessageSquare className="size-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                          Coach
                        </p>
                        {t.coachText && (
                          <p className="text-sm leading-relaxed">
                            {t.coachText}
                          </p>
                        )}
                        {t.audioUrl && (
                          <div className="flex items-center gap-2">
                            <Volume2 className="size-3.5 text-muted-foreground" />
                            <audio
                              controls
                              src={t.audioUrl}
                              className="h-8 w-full max-w-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
