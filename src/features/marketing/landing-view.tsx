"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, BarChart3, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ShareableSignalCard } from "@/components/shareable-signal-card";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

const EYEBROW =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

const STEPS = [
  {
    icon: Mic,
    color: "var(--signal-newgrad)",
    title: "Step into the room",
    desc: "Three interviewers question you by voice, in turn — real follow-ups, the way it actually goes in the room, not typing into ChatGPT.",
  },
  {
    icon: BarChart3,
    color: "var(--signal-sde2)",
    title: "The Bar Raiser drills deeper",
    desc: "Your strongest claim gets stress-tested by the highest bar in the room — exactly where a real panel would push.",
  },
  {
    icon: TrendingUp,
    color: "var(--signal-senior)",
    title: "Get a committee verdict",
    desc: "A per-interviewer read and the level you reached — New Grad, SDE II, or Senior — plus the one rep to run next. A verdict, not a number.",
  },
];

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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="absolute left-[8%] top-10 size-72 rounded-full bg-signal-senior/15 blur-[120px]" />
          <div className="absolute right-[6%] top-24 size-80 rounded-full bg-signal-sde2/15 blur-[130px]" />
          <div className="absolute bottom-0 left-1/3 size-72 rounded-full bg-signal-newgrad/12 blur-[120px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
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
              className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Face a real FAANG panel{" "}
              <span className="text-signal-senior">out loud</span> — and hear
              exactly where you stand.
            </motion.h1>
            <motion.p
              variants={staggerItem}
              className="max-w-prose text-base leading-relaxed text-muted-foreground lg:text-lg"
            >
              Three interviewers question you by voice and a committee scores
              you against the company&rsquo;s actual rubric. See whether you
              read as New Grad, SDE II, or Senior — not just whether you said
              &ldquo;um.&rdquo;
            </motion.p>
            <motion.div
              variants={staggerItem}
              className="flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  Start your first panel
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </motion.div>
            <motion.p
              variants={staggerItem}
              className="text-xs text-muted-foreground"
            >
              Free while in beta · no card
            </motion.p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            className="flex justify-center lg:justify-end"
          >
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
          </motion.div>
        </div>
      </section>

      {/* The wedge */}
      <section className="border-t bg-card/40">
        <div className="mx-auto max-w-5xl space-y-10 px-6 py-16 lg:py-20">
          <div className="space-y-3 text-center">
            <p className={EYEBROW}>The difference</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">
              Other tools cheer. We hold the bar.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-background p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Every other AI tool
              </p>
              <p className="mt-4 text-lg leading-snug">
                &ldquo;Great answer! 👍 Keep it up.&rdquo;
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Vague praise. You leave with no idea whether you&rsquo;d
                actually pass.
              </p>
            </div>
            <div className="rounded-xl border-2 border-signal-senior/40 bg-signal-senior/5 p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-signal-senior">
                Aloud
              </p>
              <p className="mt-4 text-lg leading-snug">
                &ldquo;New Grad signal on <strong>Ownership</strong>. A Senior
                would have named the specific decision they made under
                ambiguity.&rdquo;
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                The exact gap a Bar Raiser would flag — so you can close it
                before the interview.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
        <div className="mb-12 space-y-3 text-center">
          <p className={EYEBROW}>How it works</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">
            From anxious to interview-ready
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="space-y-3">
              <div
                className="flex size-11 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `color-mix(in oklch, ${step.color} 14%, transparent)`,
                  color: step.color,
                }}
              >
                <step.icon className="size-5" />
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                0{i + 1}
              </p>
              <h3 className="text-base font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="text-muted-foreground">Tuned for the bar at</span>
          <span className="rounded-full border border-signal-senior/40 bg-signal-senior/5 px-3 py-1 font-medium text-signal-senior">
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

      {/* Pricing */}
      <section id="pricing" className="border-t bg-card/40">
        <div className="mx-auto max-w-5xl space-y-10 px-6 py-16 lg:py-20">
          <div className="space-y-3 text-center">
            <p className={EYEBROW}>Pricing</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">
              Free while in beta
            </h2>
          </div>

          <p className="mx-auto max-w-xl text-center text-base leading-relaxed text-muted-foreground">
            Every panel is free while we&rsquo;re in beta — no card, no limits.
            Prefer your own account? Bring your own OpenAI key for unlimited,
            full-length interviews billed straight to you.
          </p>
          <div className="flex justify-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">Start your first panel</Link>
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Paid plans arrive after beta — there&rsquo;ll always be a free way to practice.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="size-96 rounded-full bg-signal-sde2/10 blur-[130px]" />
        </div>
        <div className="relative mx-auto max-w-3xl space-y-6 px-6 py-20 text-center lg:py-28">
          <h2 className="font-display text-3xl font-semibold tracking-tight lg:text-5xl">
            Walk in knowing you read as Senior.
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            Step into the room today — free while we&rsquo;re in beta, no card.
          </p>
          <div className="flex justify-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start your first panel
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
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
