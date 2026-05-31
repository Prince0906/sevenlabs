import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

const bodySchema = z.object({
  date: z.string().datetime().nullable(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        interviewDate: parsed.data.date ? new Date(parsed.data.date) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("[POST /api/user/interview-date]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
