import type { SpeechMetrics } from "@sevenlabs/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricsPanelProps {
  metrics: SpeechMetrics | null;
  transcript: string;
}

export function MetricsPanel({ metrics, transcript }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Delivery metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground line-clamp-3">&ldquo;{transcript}&rdquo;</p>
          <p className="text-muted-foreground">Metrics not available for this turn.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Delivery metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground line-clamp-3">&ldquo;{transcript}&rdquo;</p>
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground">Pace</dt>
            <dd className="font-medium">{metrics.wpm} WPM</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pauses</dt>
            <dd className="font-medium">{metrics.pauseCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Avg pause</dt>
            <dd className="font-medium">{metrics.avgPauseMs} ms</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fillers</dt>
            <dd className="font-medium">{metrics.fillerCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Speaking ratio</dt>
            <dd className="font-medium">
              {Math.round(metrics.speakingRatio * 100)}%
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="font-medium">{metrics.turnDurationSec}s</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
