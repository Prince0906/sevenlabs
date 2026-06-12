"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Account + data deletion (D12). Two-step so it can't be a stray click: reveal,
 * then confirm. Hard-deletes the user and everything they own (cascades at the DB),
 * then signs out. Irreversible — the copy says so plainly.
 */
export function DangerZone() {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      // Account + JWT subject are gone — drop the session and leave.
      await signOut({ callbackUrl: "/sign-in" });
    } catch {
      setError("Couldn't delete your account. Try again, or contact support.");
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-signal-newgrad/30 bg-signal-newgrad/5 p-4">
      <p className="text-sm font-medium text-foreground">Delete account</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently deletes your account and everything tied to it — every panel, verdict,
        confidence score, drill, saved outcome, your resume, and any stored API key. This
        cannot be undone.
      </p>

      {!armed ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 border-signal-newgrad/40 text-signal-newgrad hover:bg-signal-newgrad/10"
          onClick={() => setArmed(true)}
        >
          Delete account
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-signal-newgrad text-white hover:bg-signal-newgrad/90"
            disabled={deleting}
            onClick={remove}
          >
            {deleting ? "Deleting…" : "Yes, delete everything"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={() => setArmed(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-signal-newgrad">{error}</p>}
    </div>
  );
}
