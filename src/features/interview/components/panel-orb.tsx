"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PanelOrbProps {
  /** Live mic amplitude, 0..1, updated out-of-band by the VAD. */
  levelRef: RefObject<number>;
  /** The active seat's signal CSS var, e.g. var(--signal-newgrad). */
  tint: string;
  label: string;
  hint: string;
  /** True on the candidate's turn — the core reacts to mic amplitude. */
  reactive?: boolean;
  /** True while an interviewer is speaking — a slow pulse. */
  busy?: boolean;
  /** Dim cue for the handoff "panel is conferring" beat. */
  dim?: boolean;
  className?: string;
}

/**
 * The panel's voice presence — a calm, paper-friendly orb (a soft filled disc
 * with a warm tinted halo), distinct from the interviewer's VoiceOrb so the speaking
 * interviewer stays untouched. Breathes at rest; swells with the candidate's voice.
 */
export function PanelOrb({
  levelRef,
  tint,
  label,
  hint,
  reactive = false,
  busy = false,
  dim = false,
  className,
}: PanelOrbProps) {
  const coreRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const smoothRef = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      // Reduced-motion: a still, softly-lit orb — no breathe/swell RAF loop.
      if (coreRef.current) coreRef.current.style.transform = "scale(1)";
      if (haloRef.current) {
        haloRef.current.style.transform = "scale(1)";
        haloRef.current.style.opacity = "0.55";
      }
      if (ringRef.current) {
        ringRef.current.style.transform = "scale(1)";
        ringRef.current.style.opacity = "0.4";
      }
      return;
    }
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      const target = reactive ? Math.min(1, Math.max(0, levelRef.current ?? 0)) : 0;
      smoothRef.current += (target - smoothRef.current) * 0.16;
      const lvl = smoothRef.current;
      const breathe = (reactive ? 0.018 : 0.05) * Math.sin(t * (reactive ? 2.2 : 1.4));

      const core = coreRef.current;
      const halo = haloRef.current;
      const ring = ringRef.current;
      if (core) core.style.transform = `scale(${1 + lvl * 0.18 + breathe})`;
      if (halo) {
        halo.style.transform = `scale(${1 + lvl * 0.55 + breathe * 2})`;
        halo.style.opacity = String(0.55 + lvl * 0.4);
      }
      if (ring) {
        ring.style.transform = `scale(${1 + lvl * 0.34 + breathe})`;
        ring.style.opacity = String(0.4 + lvl * 0.5);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, reactive, levelRef]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center py-4 transition-opacity duration-500",
        dim && "opacity-40",
        className
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={haloRef}
          className="size-60 rounded-full blur-[90px]"
          style={{ backgroundColor: tint, opacity: 0.55 }}
        />
      </div>

      <div className="relative flex size-36 items-center justify-center">
        <div
          ref={ringRef}
          className={cn(
            "absolute inset-0 rounded-full border transition-colors duration-700",
            busy && "animate-pulse"
          )}
          style={{ borderColor: `color-mix(in oklch, ${tint} 60%, transparent)` }}
        />
        <div
          ref={coreRef}
          className={cn("relative size-20 rounded-full transition-transform", busy && "animate-pulse")}
          style={{
            background: `radial-gradient(circle at 38% 32%, color-mix(in oklch, ${tint} 35%, white), ${tint})`,
            boxShadow: `0 0 42px color-mix(in oklch, ${tint} 55%, transparent), inset 0 0 18px color-mix(in oklch, ${tint} 30%, white)`,
          }}
        />
      </div>

      <div className="relative mt-6 text-center">
        <p className="font-display text-xl font-semibold tracking-tight">{label}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
