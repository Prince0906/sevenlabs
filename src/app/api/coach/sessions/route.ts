import { NextResponse } from "next/server";
import {
  rubricScoresSchema,
  type RubricScores,
  type SignalLevel,
} from "@sevenlabs/shared-types";
import { auth } from "@/lib/auth";
import { listSessions } from "@/lib/coach/turn-orchestrator";
import { log } from "@/lib/log";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await listSessions(userId);

    const sessions = rows.map((row) => {
      let overallSignal: SignalLevel | null = null;
      const lpSet = new Set<string>();

      const scored: RubricScores[] = [];
      for (const t of row.turns) {
        if (!t.rubricScoresJson) continue;
        const parsed = rubricScoresSchema.safeParse(t.rubricScoresJson);
        if (parsed.success) scored.push(parsed.data);
      }
      for (const r of scored) {
        for (const lp of r.matchedLPs) lpSet.add(lp.name);
      }
      if (scored.length > 0) {
        overallSignal = scored[scored.length - 1]!.overallSignal;
      }

      return {
        id: row.id,
        mode: row.mode,
        status: row.status,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        _count: row._count,
        turns: row.turns.slice(0, 1).map((t) => ({ transcript: t.transcript })),
        overallSignal,
        uniqueLPsTouched: lpSet.size,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    log.error("[GET /api/coach/sessions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
