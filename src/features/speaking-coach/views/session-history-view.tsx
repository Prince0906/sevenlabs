"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { SignalLevel } from "@sevenlabs/shared-types";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";
import { pageTransition } from "@/lib/motion";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  mode: string;
  status: string;
  startedAt: string;
  _count: { turns: number };
  turns: Array<{ transcript: string | null }>;
  overallSignal: SignalLevel | null;
  uniqueLPsTouched: number;
}

const MODE_LABEL: Record<string, string> = {
  interview: "Interview",
  pitch: "Pitch",
  presentation: "Presentation",
  delivery: "Free practice",
};

export function SessionHistoryView() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coach/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="History" />

      <div className="flex-1 overflow-y-auto">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Practice history
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Recent sessions
            </h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="size-6" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center">
              <p className="text-sm font-medium">No sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a practice session to see your history here.
              </p>
              <Link
                href="/practice"
                className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
              >
                Start practicing →
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              {sessions.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/practice/history/${s.id}`}
                  className={
                    "group flex items-center gap-5 px-5 py-4 transition-colors hover:bg-accent/40" +
                    (i > 0 ? " border-t" : "")
                  }
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <p className="text-sm font-medium">
                        {formatDistanceToNow(new Date(s.startedAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {MODE_LABEL[s.mode] ?? s.mode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s._count.turns}{" "}
                        {s._count.turns === 1 ? "turn" : "turns"}
                      </p>
                      {s.uniqueLPsTouched > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {s.uniqueLPsTouched}{" "}
                          {s.uniqueLPsTouched === 1 ? "LP" : "LPs"}
                        </p>
                      )}
                    </div>
                    {s.turns[0]?.transcript && (
                      <p className="truncate text-xs text-muted-foreground">
                        {s.turns[0].transcript}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    {s.overallSignal && (
                      <p
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          SIGNAL_THEME[s.overallSignal].text
                        )}
                      >
                        {SIGNAL_LABEL[s.overallSignal]}
                      </p>
                    )}
                    <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
