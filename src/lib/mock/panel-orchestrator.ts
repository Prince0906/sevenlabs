import { prisma } from "@/lib/db";
import {
  rubricScoresSchema,
  panelVerdictSchema,
  speechMetricsSchema,
  type SpeechMetrics,
  type SignalLevel,
  type PanelVerdictData,
} from "@sevenlabs/shared-types";
import {
  buildSeatRubric,
  buildRubricUserMessage,
  seatScoresToDimensionRows,
  barRaiserDrillDepth,
  evaluateDrill,
  finalizeVerdict,
  computeComposure,
  selectOneRep,
  buildCommitteeMessage,
  COMMITTEE_DEBRIEF_PROMPT,
  DIFFICULTY_TO_INT,
  type SeatRubricOutput,
  type TurnLite,
  type CommitteeSeatInput,
} from "@sevenlabs/coach-core";
import { scoreAgainstRubric, judgeCommittee } from "@/lib/coach/openai";
import { settleReservation } from "@/lib/mock/spend";
import { log } from "@/lib/log";

const CALL_TIMEOUT_MS = 30_000;
const SEAT_ATTEMPTS = 2;

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function scoreSeat(
  seat: { id: string; ownedLPs: string[]; isBarRaiser: boolean },
  targetLevel: SignalLevel,
  fullTranscript: string
): Promise<SeatRubricOutput | null> {
  const { systemPrompt } = buildSeatRubric({
    ownedLPs: seat.ownedLPs,
    isBarRaiser: seat.isBarRaiser,
    targetLevel,
  });
  const userMessage = buildRubricUserMessage(fullTranscript);
  for (let attempt = 1; attempt <= SEAT_ATTEMPTS; attempt++) {
    try {
      const raw = await withTimeout((signal) =>
        scoreAgainstRubric(systemPrompt, userMessage, signal)
      );
      return rubricScoresSchema.parse(raw) as SeatRubricOutput;
    } catch {
      log.warn("seat scoring failed", { seatId: seat.id, attempt });
    }
  }
  return null;
}

/**
 * The off-band judgment pipeline (SYSTEM_DESIGN §5/§8/§9). Runs on Aloud's pinned
 * model, after the live session is DEBRIEF. Idempotent; throws on Bar-Raiser
 * failure so the queue can retry/FAIL rather than emit a verdict missing the veto.
 */
export async function runJudgment(sessionId: string): Promise<void> {
  const session = await prisma.mockSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: { include: { panelSeats: { orderBy: { seatOrder: "asc" } } } },
      turns: { orderBy: { seq: "asc" } },
    },
  });
  if (!session) throw new Error("session not found");
  if (session.status !== "DEBRIEF") {
    log.info("runJudgment skipped (not DEBRIEF)", { status: session.status });
    return; // idempotent
  }

  const { userId } = session;
  const company = session.scenario.company;
  const targetLevel = session.targetLevel;
  const difficultyInt = DIFFICULTY_TO_INT[session.scenario.difficulty];
  const seats = session.scenario.panelSeats;
  const barRaiserSeat = seats.find((s) => s.isBarRaiser);
  if (!barRaiserSeat) throw new Error("scenario has no Bar Raiser seat");

  const userTurns = session.turns.filter((t) => t.role === "USER");
  const fullTranscript = userTurns
    .map((t) => t.transcript ?? "")
    .filter(Boolean)
    .join("\n");

  const userTurnMetrics: SpeechMetrics[] = [];
  for (const t of userTurns) {
    const parsed = speechMetricsSchema.safeParse(t.metricsJson);
    if (parsed.success) userTurnMetrics.push(parsed.data);
  }

  // Independent per-seat scoring (timeout + retry).
  const scored = await Promise.all(
    seats.map((s) => scoreSeat(s, targetLevel, fullTranscript))
  );

  const barRaiserIdx = seats.findIndex((s) => s.id === barRaiserSeat.id);
  const barRaiserParsed = scored[barRaiserIdx];
  if (!barRaiserParsed) {
    throw new Error("bar raiser seat scoring failed"); // REQUIRED — never skip the veto
  }

  const validSeats = seats
    .map((seat, i) => ({ seat, parsed: scored[i] }))
    .filter(
      (x): x is { seat: (typeof seats)[number]; parsed: SeatRubricOutput } =>
        x.parsed !== null
    );

  const dimensionRows = validSeats.flatMap(({ seat, parsed }) =>
    seatScoresToDimensionRows(seat.id, userId, sessionId, parsed, fullTranscript)
  );

  const turnsLite: TurnLite[] = session.turns.map((t) => ({
    role: t.role as "USER" | "COACH",
    seatId: t.seatId,
  }));
  const drill = evaluateDrill({
    barRaiserScores: barRaiserParsed,
    followUpDepthApplied: barRaiserDrillDepth(turnsLite, barRaiserSeat.id),
  });

  const seatRollup = validSeats.map(({ seat, parsed }) => ({
    seatId: seat.id,
    personaName: seat.personaName,
    ownedLPs: seat.ownedLPs,
    seatSignal: parsed.overallSignal,
  }));
  const committeeSeats: CommitteeSeatInput[] = validSeats.map(
    ({ seat, parsed }) => ({
      seatId: seat.id,
      personaName: seat.personaName,
      ownedLPs: seat.ownedLPs,
      seatSignal: parsed.overallSignal,
      weakestArea: parsed.weakestArea,
    })
  );

  const committeeRaw = await withTimeout((signal) =>
    judgeCommittee(
      COMMITTEE_DEBRIEF_PROMPT,
      buildCommitteeMessage({ targetLevel, seats: committeeSeats, drill }),
      signal
    )
  );
  const modelVerdict = panelVerdictSchema.parse(committeeRaw);
  // Deterministic veto override; authoritative (non-hallucinated) seatRollup.
  const verdict: PanelVerdictData = {
    ...finalizeVerdict(modelVerdict, drill),
    seatRollup,
  };

  const composure = computeComposure(userTurnMetrics, difficultyInt);

  const gapPriorityLPs = [...dimensionRows]
    .sort((a, b) => a.score - b.score)
    .map((r) => r.key);
  const oneRep = selectOneRep(company, gapPriorityLPs);
  const oneRepGap = oneRep
    ? dimensionRows.find((r) => r.key === oneRep.lp)?.gap ?? verdict.summary
    : null;

  const passed =
    !verdict.barRaiserVeto &&
    ["STRONG_HIRE", "HIRE", "LEAN_HIRE"].includes(verdict.inclination);

  const reportJson = {
    verdict,
    confidence: composure.score,
    dimensions: dimensionRows.map((r) => ({
      key: r.key,
      seatId: r.seatId,
      signalLevel: r.signalLevel,
      score: r.score,
      evidence: r.evidence,
      gap: r.gap,
    })),
    oneRep: oneRep
      ? {
          questionId: oneRep.id,
          lp: oneRep.lp,
          text: oneRep.text,
          estMinutes: oneRep.estMinutes,
        }
      : null,
  };

  await prisma.$transaction([
    prisma.dimensionScore.createMany({ data: dimensionRows }),
    prisma.panelVerdict.create({
      data: {
        sessionId,
        overallSignal: verdict.overallSignal,
        inclination: verdict.inclination,
        barRaiserVeto: verdict.barRaiserVeto,
        summary: verdict.summary,
        seatRollup: verdict.seatRollup,
        topStrengths: verdict.topStrengths,
        topRisks: verdict.topRisks,
      },
    }),
    prisma.confidenceMetric.create({
      data: {
        userId,
        sessionId,
        score: composure.score,
        composure: composure.composure,
        resilience: null,
        selfEfficacy: null,
        difficultyApplied: difficultyInt,
      },
    }),
    prisma.mockSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        overallSignal: verdict.overallSignal,
        confidence: composure.score,
        passed,
        reportJson,
      },
    }),
    ...(oneRep && oneRepGap
      ? [
          prisma.drillAssignment.create({
            data: {
              userId,
              sourceSessionId: sessionId,
              questionId: oneRep.id,
              targetLP: oneRep.lp,
              reason: oneRepGap,
            },
          }),
        ]
      : []),
  ]);

  // Reconcile the daily spend hold (server-clock cost; SYSTEM_DESIGN §13).
  await settleReservation(sessionId, (session.spendCents ?? 0) / 100);

  log.info("panel judgment complete", {
    sessionId,
    inclination: verdict.inclination,
    veto: verdict.barRaiserVeto,
    confidence: composure.score,
  });
}
