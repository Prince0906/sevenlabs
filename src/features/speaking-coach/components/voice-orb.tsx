"use client";

import { useEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { PracticePhase } from "../hooks/use-practice-session";

const PHASE_LABEL: Record<PracticePhase, string> = {
  idle: "Ready",
  "coach-speaking": "Coach speaking",
  "your-turn": "Your turn",
  listening: "Listening",
  analyzing: "Analyzing",
  summary: "Done",
};

const PHASE_HINT: Record<PracticePhase, string> = {
  idle: "Click start to begin",
  "coach-speaking": "Listen — then it's your turn",
  "your-turn": "Speak naturally, your mic is live",
  listening: "I hear you — take your time",
  analyzing: "Reading your delivery and content…",
  summary: "",
};

// Glow hue per phase — atmosphere, not a signal label.
const PHASE_GLOW: Record<PracticePhase, string> = {
  idle: "oklch(0.6 0.03 60)",
  "coach-speaking": "oklch(0.64 0.12 255)",
  "your-turn": "oklch(0.64 0.08 60)",
  listening: "oklch(0.62 0.15 160)",
  analyzing: "oklch(0.66 0.14 58)",
  summary: "oklch(0.6 0.03 60)",
};

interface VoiceOrbProps {
  phase: PracticePhase;
  /** Live mic amplitude, 0..1, updated out-of-band by the VAD. */
  levelRef: RefObject<number>;
  className?: string;
}

export function VoiceOrb({ phase, levelRef, className }: VoiceOrbProps) {
  const coreRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const smoothRef = useRef(0);

  const reactive = phase === "your-turn" || phase === "listening";

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      const target = reactive ? Math.min(1, Math.max(0, levelRef.current ?? 0)) : 0;
      smoothRef.current += (target - smoothRef.current) * 0.18;
      const lvl = smoothRef.current;
      const breathe = (reactive ? 0.02 : 0.045) * Math.sin(t * (reactive ? 2 : 1.6));

      const core = coreRef.current;
      const r1 = ring1Ref.current;
      const r2 = ring2Ref.current;
      if (core) core.style.transform = `scale(${1 + lvl * 0.18 + breathe})`;
      if (r1) {
        r1.style.transform = `scale(${1 + lvl * 0.3 + breathe})`;
        r1.style.opacity = String(0.45 + lvl * 0.4);
      }
      if (r2) {
        r2.style.transform = `scale(${1 + lvl * 0.55 + breathe})`;
        r2.style.opacity = String(0.2 + lvl * 0.5);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reactive, levelRef]);

  const glow = PHASE_GLOW[phase];
  const busy = phase === "analyzing" || phase === "coach-speaking";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center py-6",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          className="size-64 rounded-full opacity-40 blur-[90px] transition-colors duration-700"
          style={{ backgroundColor: glow }}
        />
      </div>

      <div className="relative flex size-40 items-center justify-center">
        <div
          ref={ring2Ref}
          className={cn(
            "absolute inset-0 rounded-full border transition-colors duration-700",
            busy && "animate-pulse"
          )}
          style={{ borderColor: glow }}
        />
        <div
          ref={ring1Ref}
          className="absolute inset-5 rounded-full border transition-colors duration-700"
          style={{ borderColor: glow }}
        />
        <div
          ref={coreRef}
          className={cn(
            "relative size-16 rounded-full transition-colors duration-700",
            busy && "animate-pulse"
          )}
          style={{
            background: `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${glow} 65%, white), ${glow})`,
            boxShadow: `0 0 44px ${glow}`,
          }}
        />
      </div>

      <div className="relative mt-6 text-center">
        <p className="text-sm font-medium tabular-nums">{PHASE_LABEL[phase]}</p>
        {PHASE_HINT[phase] && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {PHASE_HINT[phase]}
          </p>
        )}
      </div>
    </div>
  );
}
