"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MetricsPanel } from "@/features/speaking-coach/components/metrics-panel";
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-4">
        <PageHeader title="Session detail" className="border-0 px-0 py-0" />
        <Button variant="outline" asChild>
          <Link href="/practice/history">Back</Link>
        </Button>
      </div>
      {loading ? (
        <Spinner className="size-6" />
      ) : (
        <div className="space-y-4">
          {turns.map((t) =>
            t.role === "USER" && t.metricsJson ? (
              <MetricsPanel
                key={t.id}
                metrics={t.metricsJson}
                transcript={t.transcript ?? ""}
              />
            ) : t.role === "COACH" ? (
              <Card key={t.id}>
                <CardContent className="pt-4 text-sm">
                  <p className="font-medium text-muted-foreground">Coach</p>
                  <p>{t.coachText}</p>
                  {t.audioUrl && (
                    <audio controls src={t.audioUrl} className="mt-2 w-full" />
                  )}
                </CardContent>
              </Card>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
