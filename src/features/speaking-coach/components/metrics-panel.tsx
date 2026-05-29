import type { SpeechMetrics } from "@sevenlabs/shared-types";

interface MetricsPanelProps {
  metrics: SpeechMetrics | null;
  transcript: string;
}

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-medium tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function MetricsPanel({ metrics, transcript }: MetricsPanelProps) {
  return (
    <div className="space-y-4">
      {transcript && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {transcript}
        </p>
      )}

      {!metrics ? (
        <p className="text-xs text-muted-foreground">
          Metrics not available for this turn.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Pace" value={`${metrics.wpm} wpm`} />
          <Stat label="Pauses" value={String(metrics.pauseCount)} />
          <Stat label="Avg pause" value={`${metrics.avgPauseMs} ms`} />
          <Stat label="Fillers" value={String(metrics.fillerCount)} />
          <Stat
            label="Speaking"
            value={`${Math.round(metrics.speakingRatio * 100)}%`}
          />
          <Stat label="Duration" value={`${metrics.turnDurationSec}s`} />
        </div>
      )}
    </div>
  );
}
