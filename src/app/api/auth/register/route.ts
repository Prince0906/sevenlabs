import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@sevenlabs/backend/infrastructure/db";
import { log } from "@sevenlabs/backend/infrastructure/log";
import { backendAuthEnabled } from "@/lib/auth-mode";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  if (backendAuthEnabled) return NextResponse.json({ error: "Registration is served by the API" }, { status: 410 });
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Don't leak whether the email exists; respond with a generic error.
      return NextResponse.json(
        { error: "Unable to create account with this email." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    log.error("[POST /api/auth/register]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
