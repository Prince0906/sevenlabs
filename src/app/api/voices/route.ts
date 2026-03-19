import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const voices = await prisma.voice.findMany({
    where: {
      OR: [{ variant: "SYSTEM" }, { orgId }],
    },
    orderBy: [{ variant: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(voices);
}

export async function POST(req: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, category, language } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const voice = await prisma.voice.create({
    data: {
      orgId,
      name,
      description: description || null,
      category: category || "GENERAL",
      language: language || "en-US",
      variant: "CUSTOM",
    },
  });

  return NextResponse.json(voice, { status: 201 });
}
