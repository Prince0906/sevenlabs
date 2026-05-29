"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { SignalLevel } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL, SIGNAL_RANK } from "@/lib/signal";

const RANK_LABEL = ["New Grad", "SDE II", "Senior"];
const LINE = "oklch(0.62 0.14 160)"; // emerald — the climb toward Senior
const AXIS = "oklch(0.58 0.02 60)";

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Signal trend
        </p>
      </div>
      {children}
    </div>
  );
}

function TrendTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { session: number; label: string };
  return (
    <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-sm">
      <span className="text-muted-foreground">Session {point.session} · </span>
      <span className="font-medium">{point.label}</span>
    </div>
  );
}

export function SignalTrendChart({ history }: { history: SignalLevel[] }) {
  if (history.length < 2) {
    return (
      <ChartShell>
        <div className="flex items-center justify-center px-6 py-12">
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            Your signal trend appears after a couple of scored interview
            sessions.
          </p>
        </div>
      </ChartShell>
    );
  }

  const data = history.map((s, i) => ({
    session: i + 1,
    rank: SIGNAL_RANK[s],
    label: SIGNAL_LABEL[s],
  }));

  return (
    <ChartShell>
      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 16, bottom: 4, left: 8 }}
          >
            <defs>
              <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis
              dataKey="rank"
              type="number"
              domain={[0, 2]}
              ticks={[0, 1, 2]}
              tickFormatter={(v: number) => RANK_LABEL[v] ?? ""}
              width={62}
              tick={{ fontSize: 11, fill: AXIS }}
              axisLine={false}
              tickLine={false}
            />
            <XAxis
              dataKey="session"
              tick={{ fontSize: 11, fill: AXIS }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="rank"
              stroke={LINE}
              strokeWidth={2}
              fill="url(#signalFill)"
              dot={{ r: 3, fill: LINE, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
