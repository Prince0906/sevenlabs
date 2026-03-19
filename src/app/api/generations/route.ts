import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const [generations, total] = await Promise.all([
    prisma.generation.findMany({
      where: { orgId },
      include: { voice: true },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.generation.count({ where: { orgId } }),
  ]);

  const generationsWithUrls = generations.map((gen) => ({
    ...gen,
    audioUrl: gen.r2ObjectKey ? `/audio/${gen.r2ObjectKey}` : null,
  }));

  return NextResponse.json({
    generations: generationsWithUrls,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
