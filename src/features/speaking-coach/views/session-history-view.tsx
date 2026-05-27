"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-4">
        <PageHeader title="Practice history" className="border-0 px-0 py-0" />
        <Button variant="outline" asChild>
          <Link href="/practice">Back to practice</Link>
        </Button>
      </div>

      {loading ? (
        <Spinner className="size-6" />
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <ul className="grid gap-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    <Link href={`/practice/history/${s.id}`} className="hover:underline">
                      {new Date(s.startedAt).toLocaleString()}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>{s.mode} · {s.status} · {s._count.turns} turns</p>
                  {s.turns[0]?.transcript && (
                    <p className="mt-1 line-clamp-2">&ldquo;{s.turns[0].transcript}&rdquo;</p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
