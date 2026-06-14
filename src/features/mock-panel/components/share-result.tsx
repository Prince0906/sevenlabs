"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { MockReport } from "@sevenlabs/shared-types";
import { Button } from "@/components/ui/button";
import { ShareableSignalCard } from "@/features/speaking-coach/components/shareable-signal-card";

/**
 * The share surface for a panel verdict — the report is the emotional peak and
 * the one organic-growth vector. Image-only by design: a verdict is private and
 * userId-scoped, so we export a branded PNG of the signal card (the card's
 * colors are explicit oklch so html-to-image renders them faithfully) and copy
 * the private session link, but never expose a public page.
 */
export function ShareResult({ report }: { report: MockReport }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const dims = report.dimensions;
  const strongest = dims.length
    ? dims.reduce((a, b) => (b.score > a.score ? b : a))
    : null;
  const weakest = dims.length
    ? dims.reduce((a, b) => (b.score < a.score ? b : a))
    : null;

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = "aloud-signal.png";
      a.click();
    } catch {
      // Best-effort — image export can fail on some browsers; the link still works.
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — no-op
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Share your result
      </h2>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div ref={cardRef}>
          <ShareableSignalCard
            signal={report.verdict.overallSignal}
            topLP={
              strongest
                ? {
                    name: strongest.key,
                    signalLevel: strongest.signalLevel,
                    evidence: strongest.evidence,
                  }
                : null
            }
            weakestArea={weakest?.gap || weakest?.key || null}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save image"}
          </Button>
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>
    </section>
  );
}
