"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ShareableSignalCard } from "@/components/shareable-signal-card";
import { RoomDemo } from "./room-demo";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

const EYEBROW =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

// The three-step sequence is real (room → Bar Raiser → verdict), so the
// numbered markers carry information, not decoration.
const STEPS = [
  {
    color: "var(--signal-newgrad)",
    title: "Step into the room",
    desc: "Three interviewers question you by voice, with real follow-ups, in turn.",
  },
  {
    color: "var(--signal-sde2)",
    title: "Survive the Bar Raiser",
    desc: "Your strongest claim gets stress-tested by the highest bar in the room.",
  },
  {
    color: "var(--signal-senior)",
    title: "Leave with a verdict",
    desc: "The level you read as, and the one rep to run next. Not a number.",
  },
];

const TRIO = [
  "var(--signal-newgrad)",
  "var(--signal-sde2)",
  "var(--signal-senior)",
];

/** The identity's signature mark: a hard-stop three-band level meter with a pin. */
function LevelMeter({ at }: { at: 0 | 1 | 2 }) {
  return (
    <div>
      <div className="relative flex h-2 gap-1">
        {TRIO.map((c, i) => (
          <span
            key={c}
            className="h-full flex-1 rounded-full"
            style={{ backgroundColor: c, opacity: i === at ? 1 : 0.25 }}
          />
        ))}
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground"
          style={{
            left: `${(at * 2 + 1) * (100 / 6)}%`,
            backgroundColor: TRIO[at],
          }}
        />
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>New Grad</span>
        <span>SDE II</span>
        <span>Senior</span>
      </div>
    </div>
  );
}


export function LandingView() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero — show the room, say almost nothing */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-6"
        >
          <motion.p variants={staggerItem} className={EYEBROW}>
            Live voice interview panel
          </motion.p>
          <motion.h1
            variants={staggerItem}
            className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Get judged before it counts.
          </motion.h1>
          <motion.p
            variants={staggerItem}
            className="max-w-md text-base leading-relaxed text-muted-foreground lg:text-lg"
          >
            A live three-interviewer panel tells you the level you read as,
            before a real one does.
          </motion.p>
          <motion.div
            variants={staggerItem}
            className="flex flex-wrap items-center gap-3"
          >
            <Button size="xl" asChild>
              <Link href="/sign-up">
                Start your first panel
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.p
            variants={staggerItem}
            className="text-xs text-muted-foreground"
          >
            Free while in beta · no card · about 15 minutes
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="flex justify-center lg:justify-end"
        >
          <RoomDemo />
        </motion.div>
      </section>

      {/* The whole product in three numbers */}
      <section className="border-y bg-secondary/40">
        <div className="mx-auto grid max-w-5xl grid-cols-3 divide-x divide-border px-6">
          {[
            ["3", "interviewers, live"],
            ["15", "minutes in the room"],
            ["1", "committee verdict"],
          ].map(([n, label]) => (
            <div key={label} className="flex flex-col items-center gap-1 py-8">
              <span className="font-mono text-4xl font-bold tabular-nums sm:text-5xl">
                {n}
              </span>
              <span className="text-center text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* The wedge — two quotes, no essay */}
      <section className="border-t bg-secondary/40">
        <div className="mx-auto max-w-5xl space-y-10 px-6 py-16 lg:py-20">
          <div className="space-y-3 text-center">
            <p className={EYEBROW}>The difference</p>
            <h2 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">
              Other tools cheer. We hold the bar.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Every other AI tool
              </p>
              <p className="mt-4 text-lg leading-snug text-muted-foreground">
                &ldquo;Great answer! Keep it up.&rdquo;
              </p>
            </div>
            <div className="piece p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
                Aloud
              </p>
              <p className="mt-4 text-lg leading-snug">
                &ldquo;<span style={{ color: "var(--signal-newgrad)" }} className="font-semibold">New Grad</span> signal
                on <strong>Ownership</strong>. A Senior would have named the
                decision they made under ambiguity.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — three pieces, one line each */}
      <section className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
        <div className="mb-12 space-y-3 text-center">
          <p className={EYEBROW}>How it works</p>
          <h2 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">
            Fifteen minutes. Three interviewers. One verdict.
          </h2>
        </div>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 md:grid-cols-3"
        >
          {STEPS.map((step, i) => (
            <motion.div key={step.title} variants={staggerItem} className="piece p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-bold tabular-nums">
                  0{i + 1}
                </span>
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: step.color }}
                  aria-hidden
                />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="text-muted-foreground">Tuned for the bar at</span>
          <span className="rounded-full border-2 border-foreground bg-card px-3 py-1 font-semibold">
            Amazon
          </span>
          <span className="rounded-full border px-3 py-1 text-muted-foreground">
            Google · soon
          </span>
          <span className="rounded-full border px-3 py-1 text-muted-foreground">
            Meta · soon
          </span>
        </div>
      </section>

      {/* The verdict — the thing you leave with */}
      <section className="border-t bg-secondary/40">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
          <div className="space-y-4">
            <p className={EYEBROW}>The verdict</p>
            <h2 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">
              Leave with a verdict, not a vibe.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Per-interviewer reads, the level you reached, and the exact gap a
              Bar Raiser would flag. Shareable if you&rsquo;re proud of it.
            </p>
            <LevelMeter at={2} />
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="rotate-1 transition-transform duration-200 hover:rotate-0">
              <ShareableSignalCard
                signal="SENIOR"
                topLP={{
                  name: "Ownership",
                  signalLevel: "SENIOR",
                  evidence:
                    "I owned the migration end-to-end and cut p99 latency by 40%.",
                }}
                weakestArea="Name the specific tradeoff you rejected when you chose gRPC over REST."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — one honest strip */}
      <section id="pricing" className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-center lg:py-20">
        <p className={EYEBROW}>Pricing</p>
        <h2 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">
          Free while in beta
        </h2>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground">
          No card, no limits. Prefer your own account? Bring your own OpenAI
          key and full-length interviews bill straight to you.
        </p>
        <div className="flex justify-center">
          <Button size="xl" asChild>
            <Link href="/sign-up">
              Start your first panel
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paid plans arrive after beta. There&rsquo;ll always be a free way to
          practice.
        </p>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo className="text-base" />
          <p className="text-xs text-muted-foreground">
            Interview prep, out loud.
          </p>
        </div>
      </footer>
    </div>
  );
}
