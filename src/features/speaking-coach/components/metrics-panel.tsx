import type { SpeechMetrics } from "@sevenlabs/shared-types";
import { Timer, Pause, MessageCircleWarning, Gauge, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsPanelProps {
  metrics: SpeechMetrics | null;
  transcript: string;
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}

function Stat({ icon: Icon, label, value, color }: StatProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          color
        )}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function MetricsPanel({ metrics, transcript }: MetricsPanelProps) {
  return (
    <div className="space-y-3">
      {transcript && (
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {!metrics ? (
        <p className="text-xs text-muted-foreground">
          Metrics not available for this turn.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Stat
            icon={Gauge}
            label="Pace"
            value={`${metrics.wpm} WPM`}
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <Stat
            icon={Pause}
            label="Pauses"
            value={String(metrics.pauseCount)}
            color="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          />
          <Stat
            icon={Timer}
            label="Avg pause"
            value={`${metrics.avgPauseMs} ms`}
            color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          />
          <Stat
            icon={MessageCircleWarning}
            label="Fillers"
            value={String(metrics.fillerCount)}
            color="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          />
          <Stat
            icon={Radio}
            label="Speaking ratio"
            value={`${Math.round(metrics.speakingRatio * 100)}%`}
            color="bg-pink-500/10 text-pink-600 dark:text-pink-400"
          />
          <Stat
            icon={Timer}
            label="Duration"
            value={`${metrics.turnDurationSec}s`}
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
        </div>
      )}
    </div>
  );
}
