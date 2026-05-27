"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Mic, ArrowRight, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  mode: string;
  status: string;
  startedAt: string;
  _count: { turns: number };
  turns: Array<{ transcript: string | null }>;
}

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
      <PageHeader title="Practice history" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="size-6" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <Mic className="size-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No sessions yet</p>
                <p className="text-sm text-muted-foreground">
                  Start a practice session to see your history here.
                </p>
              </div>
              <Link
                href="/practice"
                className="text-sm font-medium text-primary hover:underline"
              >
                Start practicing
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/practice/history/${s.id}`}
                  className="group flex gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      s.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                    )}
                  >
                    <Mic className="size-5" />
                  </div>

                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {formatDistanceToNow(new Date(s.startedAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <Badge
                        variant={
                          s.status === "COMPLETED" ? "secondary" : "outline"
                        }
                        className="text-[10px]"
                      >
                        {s.status.toLowerCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {s._count.turns} turns
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(s.startedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {s.turns[0]?.transcript && (
                      <p className="truncate text-xs text-muted-foreground">
                        &ldquo;{s.turns[0].transcript}&rdquo;
                      </p>
                    )}
                  </div>

                  <ArrowRight className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
