"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ResumeSummary {
  headline: string | null;
  factCount: number;
}

const ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

/**
 * Pre-interview resume step (INTERVIEW_ENGINE_PLAN §14.1). Optional and
 * skippable — the panel runs either way. When a resume is on file, the lead
 * interviewer opens by asking about the candidate's background and grounds its
 * follow-ups in the parsed facts. Server-side, only quote-validated facts are
 * stored, so nothing here can make the panel invent experience.
 */
export function ResumeUpload() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ResumeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/resume")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.exists) return;
        setProfile({ headline: d.headline ?? null, factCount: d.factCount ?? 0 });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "Could not read that resume. Try a different file.");
        return;
      }
      setProfile({ headline: body.headline ?? null, factCount: body.factCount ?? 0 });
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setProfile(null);
    await fetch("/api/resume", { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5 text-left">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Checking for a saved resume…</p>
      ) : profile ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              <span aria-hidden>📄 </span>Interviewing against your resume
            </p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {profile.headline ? `${profile.headline} · ` : ""}
              {profile.factCount} detail{profile.factCount === 1 ? "" : "s"} the panel can probe
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Reading…" : "Replace"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => void remove()}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Add your resume (optional)</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The panel will open by asking about your background and ground its questions in
              your real projects. PDF or text.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="shrink-0"
          >
            {uploading ? "Reading…" : "Upload resume"}
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[var(--signal-newgrad)]">{error}</p>}
    </div>
  );
}
