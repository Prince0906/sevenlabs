"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  muted?: boolean;
  className?: string;
  children?: ReactNode;
}

export function StatCard({
  label,
  value,
  sub,
  muted,
  className,
  children,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        muted && "opacity-70",
        className
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {value !== undefined && (
        <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      )}
      {children}
      {sub && (
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
