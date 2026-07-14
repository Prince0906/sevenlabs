"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Deliberating() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="flex gap-2">
        <span className="size-2 animate-pulse rounded-full bg-signal-newgrad" />
        <span className="size-2 animate-pulse rounded-full bg-signal-sde2 [animation-delay:160ms]" />
        <span className="size-2 animate-pulse rounded-full bg-signal-senior [animation-delay:320ms]" />
      </div>
      <p className="font-display text-2xl font-semibold tracking-tight">The panel is deliberating</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        The interviewers are comparing notes and reaching a committee verdict.
      </p>
    </div>
  );
}

export function FailedScreen({ reason }: { reason?: string }) {
  const timedOut = reason === "judgment_timeout";
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold tracking-tight">
        {timedOut ? "We couldn't finish scoring" : "This session failed to start"}
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {timedOut
          ? "Your transcript is saved. Try again shortly."
          : "There's nothing to score for this one."}
      </p>
      <Button variant="outline" size="sm" className="mt-2" asChild>
        <Link href="/mock">Back to panels</Link>
      </Button>
    </div>
  );
}
