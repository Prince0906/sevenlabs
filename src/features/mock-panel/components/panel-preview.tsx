"use client";

// DEV-ONLY. A static gallery of the warm-editorial panel redesign across every
// state, against mock data. Reuses the real components so what you see is what
// ships. Delete with the /mock/preview route once the redesign is signed off.
import { useRef } from "react";
import type { MockReport, PanelSeatPublic } from "@sevenlabs/shared-types";
import { PageHeader } from "@/components/page-header";
import { PanelPresences } from "./panel-presences";
import { PanelOrb } from "./panel-orb";
import { ComposureMeter } from "./composure-meter";
import { RecoveryBanner } from "./recovery-banner";
import { Intro, TranscriptLine } from "../views/mock-panel-view";
import { ReportBody, Deliberating } from "../views/mock-report-view";
import { SIGNAL_CSS_VAR, seatLevel, splitPersona } from "../lib/seat-theme";

const SEATS: PanelSeatPublic[] = [
  { id: "s0", personaName: "Maya — Builder (SDM)", ownedLPs: ["Ownership", "Bias for Action"], isBarRaiser: false, voice: "alloy" },
  { id: "s1", personaName: "Dev — Operator (Sr. SDE)", ownedLPs: ["Dive Deep", "Are Right, A Lot"], isBarRaiser: false, voice: "verse" },
  { id: "s2", personaName: "Priya — Bar Raiser (Principal)", ownedLPs: ["Highest Standards", "Earn Trust"], isBarRaiser: true, voice: "sage" },
];

const SEAT_BY_ID = new Map(
  SEATS.map((s, i): [string, { i: number; name: string }] => [s.id, { i, name: splitPersona(s.personaName).name }])
);

const TRANSCRIPT: { role: "USER" | "COACH"; seatId: string | null; text: string }[] = [
  { role: "COACH", seatId: "s2", text: "Walk me through a time you owned a decision that turned out to be wrong. What did you do once you realized?" },
  { role: "USER", seatId: null, text: "We shipped an eventual-consistency model for the cart service to hit a deadline, and within a week we saw double-charges under a race condition…" },
  { role: "COACH", seatId: "s2", text: "Before you go on — you said \"we\" decided. What part of that call was yours, specifically?" },
];

const MOCK_REPORT: MockReport = {
  verdict: {
    overallSignal: "SDE_II",
    inclination: "LEAN_HIRE",
    barRaiserVeto: false,
    summary:
      "A solid, well-structured loop. Your ownership stories landed with real metrics and you stayed composed under follow-up pressure — but the Bar Raiser wanted sharper conflict-resolution detail before endorsing at the Senior bar.",
    seatRollup: [
      { seatId: "s0", personaName: "Maya — Builder (SDM)", ownedLPs: ["Ownership", "Bias for Action"], seatSignal: "SDE_II" },
      { seatId: "s1", personaName: "Dev — Operator (Sr. SDE)", ownedLPs: ["Dive Deep", "Are Right, A Lot"], seatSignal: "SENIOR" },
      { seatId: "s2", personaName: "Priya — Bar Raiser (Principal)", ownedLPs: ["Highest Standards", "Earn Trust"], seatSignal: "SDE_II" },
    ],
    topStrengths: ["Quantified impact on every story", "Stayed calm under hard follow-ups", "Clear STAR structure"],
    topRisks: ["Thin on cross-team conflict", "Few \"what I'd do differently\" reflections"],
  },
  confidence: 72,
  dimensions: [
    { key: "Earn Trust", seatId: "s2", signalLevel: "NEW_GRAD", score: 48, evidence: "Deferred to your manager the moment the design was challenged.", gap: "Show you can hold a position with data when a senior engineer pushes back." },
    { key: "STAR Structure", seatId: null, signalLevel: "SDE_II", score: 68, evidence: "Situation and Action were crisp; the Result sometimes trailed off.", gap: "Close every story with a measured, clearly owned result." },
    { key: "Ownership", seatId: "s0", signalLevel: "SENIOR", score: 88, evidence: "Took the pager, owned the rollback, wrote the postmortem yourself.", gap: "Keep leading with the decision you personally made." },
  ],
  oneRep: {
    questionId: "q-earn-trust-1",
    lp: "Earn Trust — disagreeing with a senior",
    text: "Tell me about a time you held your position against a more senior engineer. Lead with the data, not the title.",
    estMinutes: 6,
  },
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

export function PanelPreview() {
  const levelRef = useRef(0.5);

  return (
    <div className="panel-stage flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <PageHeader title="Panel Redesign — Preview (dev)" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-16 p-6 lg:p-12">
        <Section label="intro">
          <Intro onStart={() => {}} />
        </Section>

        <Section label="live · your turn">
          <div className="space-y-10">
            <PanelPresences seats={SEATS} activeSeatIndex={0} activeSpeaker="USER" completedSeatIndexes={[]} />
            <PanelOrb levelRef={levelRef} tint={SIGNAL_CSS_VAR[seatLevel(0)]} label="Your turn" hint="Speak naturally — your mic is live" reactive />
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Transcript</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-5">
                {TRANSCRIPT.map((t, i) => (
                  <TranscriptLine key={i} role={t.role} seatId={t.seatId} text={t.text} seatById={SEAT_BY_ID} />
                ))}
              </div>
            </div>
            <ComposureMeter running={false} maxDurationSec={2700} bargeIns={1} />
          </div>
        </Section>

        <Section label="live · interviewer speaking (seat 3, handoffs done)">
          <div className="space-y-10">
            <PanelPresences seats={SEATS} activeSeatIndex={2} activeSpeaker="COACH" completedSeatIndexes={[0, 1]} />
            <PanelOrb
              levelRef={levelRef}
              tint={SIGNAL_CSS_VAR[seatLevel(2)]}
              label="Priya is speaking"
              hint="Bar Raiser (Principal)"
              busy
            />
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Transcript</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-5">
                {TRANSCRIPT.map((t, i) => (
                  <TranscriptLine key={i} role={t.role} seatId={t.seatId} text={t.text} seatById={SEAT_BY_ID} />
                ))}
                <TranscriptLine role="COACH" seatId="s2" text="So what would you do differently if you" seatById={SEAT_BY_ID} streaming />
              </div>
            </div>
          </div>
        </Section>

        <Section label="verdict report">
          <ReportBody report={MOCK_REPORT} />
        </Section>

        <Section label="deliberating">
          <Deliberating />
        </Section>

        <Section label="recovery · disconnected">
          <RecoveryBanner kind="disconnected" onEndAndScore={() => {}} />
        </Section>
        </div>
      </div>
    </div>
  );
}
