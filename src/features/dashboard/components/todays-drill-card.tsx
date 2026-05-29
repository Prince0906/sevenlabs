"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface TodaysDrillCardProps {
  lpName: string;
  questionText: string;
  estMinutes: number;
  reason: string;
}

export function TodaysDrillCard({
  lpName,
  questionText,
  estMinutes,
  reason,
}: TodaysDrillCardProps) {
  const href = `/practice?mode=interview&drillLP=${encodeURIComponent(lpName)}`;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Today&rsquo;s drill · {lpName}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          ~{estMinutes} min
        </p>
      </div>
      <div className="space-y-4 px-6 py-6 lg:px-8 lg:py-7">
        <p className="text-lg leading-snug tracking-tight lg:text-xl">
          {questionText}
        </p>
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="text-xs text-muted-foreground">{reason}</p>
          <Button asChild>
            <Link href={href}>Start drill</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
