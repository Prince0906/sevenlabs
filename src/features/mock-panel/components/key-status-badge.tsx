"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface KeyStatus {
  byokEnabled: boolean;
  exists: boolean;
  status?: string;
  last4?: string;
}

const CAP_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Off", value: null },
  { label: "$5", value: 5 },
  { label: "$10", value: 10 },
  { label: "$20", value: 20 },
];

/**
 * Green-room BYOK indicator + spend controls (§3.7). Tells the candidate whether
 * the panel runs on THEIR key or the trial, shows the pre-session cost estimate,
 * and lets them set an opt-in auto-stop before the clock starts. Renders nothing
 * when BYOK isn't enabled (everyone's on the house key — nothing to choose).
 */
export function KeyStatusBadge({
  spendCapUsd,
  onSetSpendCap,
}: {
  spendCapUsd?: number | null;
  onSetSpendCap?: (v: number | null) => void;
} = {}) {
  const [status, setStatus] = useState<KeyStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => !cancelled && setStatus(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || !status.byokEnabled) return null;
  const onOwnKey = status.exists && status.status === "ACTIVE";

  if (!onOwnKey) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: "var(--clay)" }} />
        <span>
          Trial mode —{" "}
          <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
            add your key
          </Link>{" "}
          for unlimited, full-length panels
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: "var(--signal-senior)" }}
        />
        <span>
          Running on your OpenAI key <span className="font-mono">(sk-…{status.last4})</span>
        </span>
      </div>
      <p className="max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground/70">
        A full panel typically runs $3–8 on your key; a long session costs more because realtime
        re-bills context as it grows.
      </p>
      {onSetSpendCap && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">Auto-stop at</span>
          {CAP_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onSetSpendCap(o.value)}
              className={cn(
                "rounded-full border px-2 py-0.5 transition-colors",
                (spendCapUsd ?? null) === o.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
