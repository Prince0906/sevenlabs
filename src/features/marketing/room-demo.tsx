"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The playable hero: a ~20-second scripted round of the real product loop
 * (question → you're on air → deliberation → verdict). No mic, no audio —
 * a pantomime honest about being scripted, teaching the two things that
 * matter before sign-up: red means your mic is live, and you leave with a
 * level, not a cheer.
 */

type Stage = "idle" | "answering" | "deliberating" | "verdict";

const TRIO = [
  "var(--signal-newgrad)",
  "var(--signal-sde2)",
  "var(--signal-senior)",
] as const;

const LEVELS = ["New Grad", "SDE II", "Senior"] as const;

const SEATS = [
  { initials: "MA", name: "Marcus", role: "Builder" },
  { initials: "EL", name: "Elena", role: "Eng Manager" },
  { initials: "RK", name: "Rika", role: "Bar Raiser" },
];

const ROUNDS: {
  seat: number;
  question: string;
  level: 0 | 1 | 2;
  gap: string;
}[] = [
  {
    seat: 1,
    question:
      "You said the migration was your call. Walk me through the moment it almost wasn't.",
    level: 1,
    gap: "A Senior names the tradeoff they rejected.",
  },
  {
    seat: 0,
    question: "What actually re-renders when that state changes?",
    level: 0,
    gap: "The panel pressed once, and the answer thinned out.",
  },
  {
    seat: 2,
    question: "Your strongest claim: defend it without the metric.",
    level: 2,
    gap: "Held up under the follow-up. That's the bar.",
  },
];

function useTypewriter(text: string, active: boolean, instant: boolean) {
  const [chars, setChars] = useState(0);
  // Reset for a new question during render (the sanctioned "adjust state when
  // props change" pattern) — no synchronous setState inside the effect.
  const [prevText, setPrevText] = useState(text);
  if (prevText !== text) {
    setPrevText(text);
    setChars(0);
  }
  useEffect(() => {
    if (!active || instant) return;
    const id = setInterval(() => {
      setChars((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 2;
      });
    }, 26);
    return () => clearInterval(id);
  }, [text, active, instant]);
  return instant ? text : text.slice(0, chars);
}

/** Fake voice bars while "answering" — transform-only, stilled for reduced motion. */
function Waveform({ still }: { still: boolean }) {
  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden>
      {[0.9, 0.5, 1, 0.65, 0.8, 0.45, 0.7].map((peak, i) =>
        still ? (
          <span
            key={i}
            className="w-[3px] rounded-full bg-live"
            style={{ height: `${peak * 100}%`, opacity: 0.85 }}
          />
        ) : (
          <motion.span
            key={i}
            className="w-[3px] origin-bottom rounded-full bg-live"
            style={{ height: "100%" }}
            animate={{ scaleY: [0.25, peak, 0.35, peak * 0.75, 0.25] }}
            transition={{
              repeat: Infinity,
              duration: 1.05,
              ease: "easeInOut",
              delay: i * 0.09,
            }}
          />
        )
      )}
    </span>
  );
}

export function RoomDemo() {
  const reduced = useReducedMotion() ?? false;
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  // null until the first verdict lands; then the pin exists and springs between rounds.
  const [pinLevel, setPinLevel] = useState<0 | 1 | 2 | null>(null);

  const r = ROUNDS[round % ROUNDS.length];
  const typed = useTypewriter(r.question, stage === "idle", reduced);
  const asking = stage === "idle" || stage === "deliberating";

  useEffect(() => {
    if (stage !== "deliberating") return;
    const t = setTimeout(
      () => {
        setPinLevel(r.level);
        setStage("verdict");
      },
      reduced ? 350 : 1500
    );
    return () => clearTimeout(t);
  }, [stage, reduced, r.level]);

  const advance = () => {
    if (stage === "idle") setStage("answering");
    else if (stage === "answering") setStage("deliberating");
  };
  const nextRound = () => {
    setRound((n) => (n + 1) % ROUNDS.length);
    setStage("idle");
  };

  return (
    <div
      role="group"
      aria-label="Interactive demo: one scripted round of a live interview panel"
      className="piece relative w-full max-w-sm -rotate-1 p-5 transition-transform duration-200 hover:rotate-0"
    >
      {/* If it's red, you're on air — the frame teaches the rule before sign-up. */}
      <AnimatePresence>
        {stage === "answering" && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-0.5 border-[3px] border-live"
            style={{ borderRadius: "calc(var(--radius) + 4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Live panel · scripted demo
        </p>
        <span
          className={
            "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-opacity " +
            (stage === "answering" ? "opacity-100" : "opacity-35")
          }
        >
          <span
            className={
              "size-2 rounded-full bg-live" +
              (stage === "answering" && !reduced ? " animate-pulse" : "")
            }
            aria-hidden
          />
          On air
        </span>
      </div>

      {/* The three seats — the asker holds the cobalt ring; while you speak, nobody does. */}
      <div className="mt-5 flex items-end justify-center gap-5" aria-hidden>
        {SEATS.map((seat, i) => {
          const active = asking && i === r.seat;
          return (
            <div key={seat.initials} className="flex flex-col items-center gap-1.5">
              <span
                className={
                  "flex size-12 items-center justify-center rounded-full border-2 border-foreground bg-secondary text-sm font-bold transition-all duration-200" +
                  (active
                    ? " ring-3 ring-primary ring-offset-2 ring-offset-card"
                    : stage === "answering"
                      ? " opacity-50"
                      : "")
                }
              >
                {seat.initials}
              </span>
              <span
                className={
                  "text-[10px] font-medium uppercase tracking-[0.08em] " +
                  (active ? "text-primary" : "text-muted-foreground")
                }
              >
                {active ? "Asking" : seat.role}
              </span>
            </div>
          );
        })}
      </div>

      {/* Transcript window — fixed height so stage changes never jump the layout. */}
      <div className="mt-5 flex min-h-[104px] flex-col justify-center rounded-lg border border-border bg-background px-3.5 py-3">
        {stage === "answering" ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-live">
                You · on the record
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Say your piece. The panel is listening.
              </p>
            </div>
            <Waveform still={reduced} />
          </div>
        ) : stage === "deliberating" ? (
          <div className="flex items-center gap-2.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={"size-1.5 rounded-full bg-foreground" + (reduced ? "" : " animate-pulse")}
                style={{ animationDelay: `${i * 180}ms` }}
                aria-hidden
              />
            ))}
            <p className="text-[13px] text-muted-foreground">
              The panel is deliberating…
            </p>
          </div>
        ) : stage === "verdict" ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Committee verdict
            </p>
            <p className="mt-1 text-[15px] font-semibold">
              You read as{" "}
              <span style={{ color: TRIO[r.level] }}>{LEVELS[r.level]}</span>
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {r.gap}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {SEATS[r.seat].name} · {SEATS[r.seat].role}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed">
              &ldquo;{typed}&rdquo;
              <span
                className="ml-0.5 inline-block animate-pulse text-primary"
                aria-hidden
              >
                ▍
              </span>
            </p>
          </div>
        )}
      </div>

      {/* The one control — same button, same rule as the real room. */}
      <div className="mt-4">
        {stage === "verdict" ? (
          <Button variant="outline" className="w-full" onClick={nextRound}>
            Next question
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            variant={stage === "answering" ? "destructive" : "default"}
            className="w-full"
            disabled={stage === "deliberating"}
            onClick={advance}
          >
            {stage === "idle"
              ? "Start answering"
              : stage === "answering"
                ? "Send to the panel"
                : "Scoring your answer…"}
          </Button>
        )}
      </div>

      {/* The signature mark: hard-stop bands, a pin that only moves on a verdict. */}
      <div className="mt-5" aria-hidden>
        <div className="relative flex h-2 gap-1">
          {TRIO.map((c, i) => (
            <span
              key={c}
              className="h-full flex-1 rounded-full transition-opacity duration-300"
              style={{
                backgroundColor: c,
                opacity: stage === "verdict" && pinLevel === i ? 1 : 0.25,
              }}
            />
          ))}
          {pinLevel !== null && (
            <motion.span
              className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-foreground"
              style={{ backgroundColor: TRIO[pinLevel], x: "-50%" }}
              initial={false}
              animate={{ left: `${(pinLevel * 2 + 1) * (100 / 6)}%` }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 20 }
              }
            />
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-3 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          <span>New Grad</span>
          <span>SDE II</span>
          <span>Senior</span>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        A scripted round. Click through it. The real one talks back.
      </p>
    </div>
  );
}
