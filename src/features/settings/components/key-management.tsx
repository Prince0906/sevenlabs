"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface KeyStatus {
  exists: boolean;
  byokEnabled: boolean;
  last4?: string;
  status?: "ACTIVE" | "INVALID" | "EXHAUSTED" | "REVOKED";
  lastValidatedAt?: string | null;
}

const STATUS_LABEL: Record<string, { text: string; tint: string }> = {
  ACTIVE: { text: "Active", tint: "var(--signal-senior)" },
  INVALID: { text: "Invalid — re-add", tint: "var(--destructive)" },
  EXHAUSTED: { text: "No quota", tint: "var(--destructive)" },
  REVOKED: { text: "Revoked", tint: "var(--destructive)" },
};

/**
 * BYOK key management (INTERVIEW_ENGINE_PLAN §3). Paste an OpenAI key once; it's
 * validated, encrypted, and used only to mint your panel's realtime sessions.
 * The key is never shown again — only the last 4 digits and its status. Removing
 * it is immediate (hard delete). Realtime minutes bill to the user's own account.
 */
export function KeyManagement() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => !cancelled && setStatus(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    const key = value.trim();
    if (!key) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "OPENAI", key }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "Could not save that key.");
        return;
      }
      setStatus({ exists: true, byokEnabled: true, last4: body.last4, status: "ACTIVE" });
      setValue("");
      setEditing(false);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError(null);
    await fetch("/api/keys", { method: "DELETE" }).catch(() => {});
    setStatus({ exists: false, byokEnabled: true });
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (status && status.byokEnabled === false) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <p className="text-[15px] font-semibold">Bring your own API key</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Not enabled on this server yet — your panels run on the shared trial key.
        </p>
      </div>
    );
  }

  const hasKey = status?.exists && !editing;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <p className="text-[15px] font-semibold">Your OpenAI API key</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Run unlimited, full-length panels on your own key. It&apos;s encrypted, used only to
        start your interviews, and never shown again — the realtime minutes bill to your OpenAI
        account. Remove it anytime.
      </p>

      {hasKey ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_LABEL[status!.status ?? "ACTIVE"]?.tint }}
            />
            <span className="truncate text-sm">
              <span className="font-mono">sk-…{status!.last4}</span>
              <span className="text-muted-foreground">
                {" · "}
                {STATUS_LABEL[status!.status ?? "ACTIVE"]?.text ?? status!.status}
              </span>
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void remove()}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Input
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            disabled={saving}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving || !value.trim()}>
              {saving ? "Validating…" : "Save key"}
            </Button>
            {status?.exists && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                  setError(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  );
}
