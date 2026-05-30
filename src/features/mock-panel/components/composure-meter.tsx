"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ComposureMeterProps {
  running: boolean;
  maxDurationSec: number;
  bargeIns: number;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** A calm steadiness read during the interview — anxiety-reducing language, not
 * a score. Delivery metrics are softer in live mode (no word timings), so this
 * leans on barge-ins + time and says so. */
export function ComposureMeter({ running, maxDurationSec, bargeIns }: ComposureMeterProps) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const pct = maxDurationSec > 0 ? Math.min(100, (elapsed / maxDurationSec) * 100) : 0;
  const steadiness = bargeIns === 0 ? "Composed" : bargeIns <= 2 ? "Steady" : "Recovering";

  return (
    <div className="rounded-lg border bg-card/60 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Composure
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {fmt(elapsed)} / {fmt(maxDurationSec)}
        </span>
      </div>
      <div className="mt-2 h-px w-full bg-border">
        <div
          className="h-px bg-muted-foreground/50 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className={cn("text-sm font-medium", steadiness === "Recovering" && "text-muted-foreground")}>
          {steadiness}
        </span>
        <span className="text-[11px] text-muted-foreground/70">
          Delivery read is approximate in live mode
        </span>
      </div>
    </div>
  );
}
