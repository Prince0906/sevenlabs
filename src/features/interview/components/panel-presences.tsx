"use client";

import { Check } from "lucide-react";
import type { PanelSeatPublic } from "@sevenlabs/shared-types";
import { cn } from "@/lib/utils";
import { seatLevel, splitPersona, SIGNAL_CSS_VAR } from "../lib/seat-theme";

interface PanelPresencesProps {
  seats: PanelSeatPublic[];
  activeSeatIndex: number;
  activeSpeaker: "USER" | "INTERVIEWER" | null;
  completedSeatIndexes: number[];
}

/** The three interviewers as PRESENCES in a dim room. The active one is spotlit,
 * larger, and leans in; the others recede into the dark. The speaking presence
 * breathes. This is the "three real evaluators are in the room with you" cue. */
export function PanelPresences({
  seats,
  activeSeatIndex,
  activeSpeaker,
  completedSeatIndexes,
}: PanelPresencesProps) {
  return (
    <div className="flex items-start justify-center gap-6 sm:gap-10 lg:gap-16">
      {seats.map((seat, i) => {
        const tint = SIGNAL_CSS_VAR[seatLevel(i)];
        const isActive = i === activeSeatIndex;
        const isDone = completedSeatIndexes.includes(i);
        const speaking = isActive && activeSpeaker === "INTERVIEWER";
        const { name, role } = splitPersona(seat.personaName);
        const size = isActive ? 60 : 40;

        return (
          <div
            key={seat.id}
            className="flex w-19 flex-col items-center text-center transition-all duration-700 ease-out sm:w-auto sm:max-w-30"
            style={{
              transform: isActive ? "translateY(-8px)" : "none",
              opacity: isActive ? 1 : isDone ? 0.65 : 0.4,
            }}
          >
            <div className="relative flex h-16 items-center justify-center">
              {/* spotlight pool — a warm tinted glow behind the active presence */}
              <div
                aria-hidden
                className="absolute size-28 rounded-full blur-2xl transition-opacity duration-700"
                style={{ backgroundColor: tint, opacity: isActive ? 0.5 : 0 }}
              />
              {/* presence core */}
              <div
                className={cn("relative rounded-full transition-all duration-700", speaking && "panel-breathe")}
                style={{
                  width: size,
                  height: size,
                  background: `radial-gradient(circle at 40% 34%, color-mix(in oklch, ${tint} 72%, white), ${tint})`,
                  boxShadow: isActive
                    ? `0 0 26px color-mix(in oklch, ${tint} 55%, transparent)`
                    : `0 0 0 transparent`,
                }}
              >
                {isDone && (
                  <Check
                    className="absolute inset-0 m-auto size-5"
                    style={{ color: "oklch(0.2 0.013 50)" }}
                    aria-label="done"
                  />
                )}
              </div>
            </div>
            <p
              className={cn(
                "mt-3 w-full truncate font-display text-base font-semibold tracking-tight transition-colors duration-500",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {name}
            </p>
            {/* Long role labels blow out the row on a 390px phone, so the role is
                hidden below sm — the name + spotlight carry it on mobile. */}
            <p className="mt-1 hidden w-full truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:block">
              {seat.isBarRaiser ? "Bar Raiser" : role || "Interviewer"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
