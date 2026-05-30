"use client";

// STEP-1 THROWAWAY dev page (REALTIME_CLIENT_PLAN.md step 1). Drives the raw GA
// transport harness against the live API. Delete with dev-harness.ts after Step 1.
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { runHarness, type HarnessHandle } from "@/features/mock-panel/lib/dev-harness";
import * as api from "@/features/mock-panel/lib/mock-api";

const SCENARIO_ID = "amzn-bar-raiser-p0";

export default function HarnessPage() {
  const [status, setStatus] = useState("idle");
  const [skipUpdate, setSkipUpdate] = useState(false);
  const handleRef = useRef<HarnessHandle | null>(null);

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="p-12 text-sm text-muted-foreground">Not available in production.</div>
    );
  }

  const run = async () => {
    setStatus("creating session…");
    const r = await api.createSession(SCENARIO_ID, crypto.randomUUID());
    if (r.kind !== "ok") {
      setStatus(`create failed: ${r.kind}`);
      return;
    }
    setStatus("getting mic…");
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStatus("connecting — watch the console, then Stop");
    handleRef.current = await runHarness({
      ephemeral: r.data.ephemeral,
      micStream,
      sendSessionUpdate: !skipUpdate,
    });
  };

  const stop = () => {
    handleRef.current?.close();
    handleRef.current = null;
    setStatus("stopped — see console summary");
  };

  return (
    <>
      <PageHeader title="Realtime Harness (dev)" />
      <div className="mx-auto w-full max-w-xl space-y-4 p-6 lg:p-12">
        <p className="text-sm text-muted-foreground">
          Open the browser console. Click Run, speak a sentence, wait for a reply, then
          Stop and read the summary against the Step-1 checklist.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={skipUpdate}
            onChange={(e) => setSkipUpdate(e.target.checked)}
          />
          Skip client session.update (prove mint-baked transcription)
        </label>
        <div className="flex gap-2">
          <Button onClick={() => void run()}>Run</Button>
          <Button variant="outline" onClick={stop}>
            Stop &amp; summarize
          </Button>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{status}</p>
      </div>
    </>
  );
}
