"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface SetInterviewDateDialogProps {
  currentDate: Date | null;
}

export function SetInterviewDateDialog({ currentDate }: SetInterviewDateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    currentDate ? currentDate.toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextDateIso: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/interview-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: nextDateIso }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function onConfirm() {
    if (!date) return;
    const iso = new Date(`${date}T00:00:00.000Z`).toISOString();
    void save(iso);
  }

  function onClear() {
    setDate("");
    void save(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button variant="outline" size="sm" {...props}>
            <Calendar className="size-4" />
            {currentDate ? "Update interview date" : "Set your interview date"}
          </Button>
        )}
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>When&rsquo;s your interview?</DialogTitle>
          <DialogDescription>
            We&rsquo;ll show a countdown on your dashboard and pace your daily drills.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          {currentDate && (
            <Button
              variant="ghost"
              onClick={onClear}
              disabled={saving}
            >
              Clear
            </Button>
          )}
          <Button onClick={onConfirm} disabled={saving || !date}>
            {saving && <Spinner className="size-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
