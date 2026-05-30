"use client";

import { Check } from "lucide-react";
import type { PanelSeatPublic } from "@sevenlabs/shared-types";
import { SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";
import { seatLevel, splitPersona, SIGNAL_CSS_VAR } from "../lib/seat-theme";

interface PanelSeatRailProps {
  seats: PanelSeatPublic[];
  activeSeatIndex: number;
  activeSpeaker: "USER" | "COACH" | null;
  completedSeatIndexes: number[];
}

/** The three interviewers as presence. Persona names in Fraunces (serif-for-
 * people is the strongest "real evaluators, not one LLM" signal); the active
 * seat is full-opacity with a tinted ring, the rest recede to ~55%. */
export function PanelSeatRail({
  seats,
  activeSeatIndex,
  activeSpeaker,
  completedSeatIndexes,
}: PanelSeatRailProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {seats.map((seat, i) => {
        const level = seatLevel(i);
        const theme = SIGNAL_THEME[level];
        const isActive = i === activeSeatIndex;
        const isDone = completedSeatIndexes.includes(i);
        const { name, role } = splitPersona(seat.personaName);
        const speaking = isActive && activeSpeaker === "COACH";
        const listening = isActive && activeSpeaker === "USER";

        return (
          <div
            key={seat.id}
            className={cn(
              "relative rounded-lg border border-l-2 bg-card p-4 transition-all duration-500",
              theme.border,
              isActive ? cn("opacity-100", theme.bg) : "opacity-55"
            )}
            style={isActive ? { boxShadow: `0 0 0 1px ${SIGNAL_CSS_VAR[level]}` } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold tracking-tight">
                  {name}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {role || "Interviewer"}
                </p>
              </div>
              <SeatDot done={isDone} speaking={speaking} listening={listening} theme={theme} />
            </div>

            {seat.isBarRaiser && (
              <div className="mt-3">
                <span
                  className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
                    theme.bg,
                    theme.text
                  )}
                >
                  Bar Raiser
                </span>
                <p className="mt-1.5 text-[11px] italic leading-relaxed text-muted-foreground/80">
                  Highest bar on the panel — stress-tests your strongest claim.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeatDot({
  done,
  speaking,
  listening,
  theme,
}: {
  done: boolean;
  speaking: boolean;
  listening: boolean;
  theme: { dot: string; text: string };
}) {
  if (done) {
    return (
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", theme.text)}>
        <Check className="size-4" />
      </span>
    );
  }
  const active = speaking || listening;
  return (
    <span
      className={cn(
        "mt-1 block size-2.5 shrink-0 rounded-full transition-colors",
        active ? theme.dot : "bg-border",
        speaking && "animate-pulse"
      )}
      aria-label={speaking ? "speaking" : listening ? "listening" : "waiting"}
    />
  );
}
