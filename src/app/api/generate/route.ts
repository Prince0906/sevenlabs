import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateMockAudio } from "@/lib/mock-tts";

export async function POST(req: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    text,
    voiceId,
    temperature = 0.7,
    topP = 0.9,
    topK = 50,
    repetitionPenalty = 1.0,
  } = body;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  if (!voiceId || typeof voiceId !== "string") {
    return NextResponse.json({ error: "Voice is required" }, { status: 400 });
  }

  const voice = await prisma.voice.findUnique({ where: { id: voiceId } });
  if (!voice) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  const { filename, audioUrl } = await generateMockAudio(text);

  const generation = await prisma.generation.create({
    data: {
      orgId,
      voiceId,
      text,
      voiceName: voice.name,
      r2ObjectKey: filename,
      temperature,
      topP,
      topK,
      repetitionPenalty,
    },
    include: { voice: true },
  });

  return NextResponse.json({ ...generation, audioUrl });
}
