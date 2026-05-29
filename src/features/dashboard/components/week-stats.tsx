"use client";

import type { WeekStats as WeekStatsData } from "@/lib/coach/aggregate-types";
import { cn } from "@/lib/utils";

interface WeekStatsProps {
  stats: WeekStatsData;
  seniorLPs: string[];
}

export function WeekStats({ stats, seniorLPs }: WeekStatsProps) {
  const fillerImproved = stats.deltaPct !== null && stats.deltaPct < 0;
  const fillerRegressed = stats.deltaPct !== null && stats.deltaPct > 0;

  const progress = Math.min(
    100,
    Math.round((stats.sessionsThisWeek / stats.sessionsTarget) * 100)
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          This week
        </p>
      </div>
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="space-y-3 px-6 py-5">
          <p className="text-xs text-muted-foreground">Sessions</p>
          <p className="font-display text-2xl font-semibold tabular-nums tracking-tight">
            {stats.sessionsThisWeek}
            <span className="text-base font-normal text-muted-foreground">
              {" / "}
              {stats.sessionsTarget}
            </span>
          </p>
          <div className="h-px w-full bg-border">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-xs text-muted-foreground">Fillers / min</p>
          <p className="font-display text-2xl font-semibold tabular-nums tracking-tight">
            {stats.fillersPerMinNow ?? "—"}
          </p>
          {stats.deltaPct !== null ? (
            <p
              className={cn(
                "text-xs",
                fillerImproved
                  ? "text-foreground"
                  : fillerRegressed
                    ? "text-muted-foreground"
                    : "text-muted-foreground"
              )}
            >
              {fillerImproved ? "Down" : fillerRegressed ? "Up" : "Even"}{" "}
              {Math.abs(stats.deltaPct)}% from{" "}
              {stats.fillersPerMinPrior ?? "—"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Not enough data yet
            </p>
          )}
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-xs text-muted-foreground">LPs at Senior</p>
          <p
            className={cn(
              "font-display text-2xl font-semibold tabular-nums tracking-tight",
              seniorLPs.length > 0 && "text-signal-senior"
            )}
          >
            {seniorLPs.length}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {seniorLPs.length === 0
              ? "Reach Senior on any LP"
              : seniorLPs.slice(0, 3).join(" · ") +
                (seniorLPs.length > 3 ? ` · +${seniorLPs.length - 3}` : "")}
          </p>
        </div>
      </div>
    </div>
  );
}
