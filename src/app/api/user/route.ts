import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Account + data deletion (D12, data-lifecycle). Hard-deletes the authenticated
 * user; every user-owned row cascades at the DB (auth accounts/sessions, practice +
 * mock runs and their turns/verdicts/scores, confidence metrics, drills, outcomes,
 * resume profile, BYOK keys) — all those relations are `onDelete: Cascade`.
 * userId-scoped: a caller can only delete THEMSELVES. Irreversible; the client
 * signs out afterward.
 */
export async function DELETE() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await prisma.user.delete({ where: { id: userId } });
    log.info("account deleted", { userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[DELETE /api/user]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
