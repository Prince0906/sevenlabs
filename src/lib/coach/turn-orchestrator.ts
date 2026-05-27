import {
  analyzeSpeech,
  buildCoachUserMessage,
  COACH_SYSTEM_PROMPT,
  OPENING_COACH_TEXT,
} from "@sevenlabs/coach-core";
import type { TurnCompleteResponse } from "@sevenlabs/shared-types";
import { prisma } from "@/lib/db";
import { uploadAudio, getSignedUrl } from "@/lib/s3";
import {
  generateCoachText,
  synthesizeCoachSpeech,
  transcribeAudio,
} from "./openai";

export interface ProcessTurnInput {
  userId: string;
  sessionId: string;
  clientTurnId: string;
  audioBuffer: Buffer;
  mimeType: string;
}

export async function createPracticeSession(
  userId: string,
  mode: string = "delivery"
) {
  const session = await prisma.practiceSession.create({
    data: { userId, mode },
  });

  let openingCoachAudioUrl: string | undefined;
  try {
    const audio = await synthesizeCoachSpeech(OPENING_COACH_TEXT);
    const key = `practice/${userId}/${session.id}/opening.mp3`;
    await uploadAudio(key, audio, "audio/mpeg");
    openingCoachAudioUrl = await getSignedUrl(key);
    await prisma.practiceTurn.create({
      data: {
        sessionId: session.id,
        role: "COACH",
        coachText: OPENING_COACH_TEXT,
        audioKey: key,
      },
    });
  } catch {
    await prisma.practiceTurn.create({
      data: {
        sessionId: session.id,
        role: "COACH",
        coachText: OPENING_COACH_TEXT,
      },
    });
  }

  return {
    sessionId: session.id,
    openingCoachText: OPENING_COACH_TEXT,
    openingCoachAudioUrl,
  };
}

export async function processTurn(
  input: ProcessTurnInput
): Promise<TurnCompleteResponse> {
  const session = await prisma.practiceSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    include: { turns: { where: { role: "USER" } } },
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const existing = await prisma.practiceTurn.findUnique({
    where: {
      sessionId_clientTurnId: {
        sessionId: input.sessionId,
        clientTurnId: input.clientTurnId,
      },
    },
  });

  if (existing) {
    const coachTurn = await prisma.practiceTurn.findFirst({
      where: {
        sessionId: input.sessionId,
        role: "COACH",
        createdAt: { gte: existing.createdAt },
      },
      orderBy: { createdAt: "asc" },
    });

    const metrics = (existing.metricsJson ?? null) as TurnCompleteResponse["metrics"] | null;
    let coachAudioUrl: string | undefined;
    if (coachTurn?.audioKey) {
      coachAudioUrl = await getSignedUrl(coachTurn.audioKey);
    }

    return {
      turnId: existing.id,
      transcript: existing.transcript ?? "",
      words: [],
      metrics,
      coachText: coachTurn?.coachText ?? "",
      coachAudioUrl,
      duplicate: true,
    };
  }

  const userAudioKey = `practice/${input.userId}/${input.sessionId}/${input.clientTurnId}-user.webm`;
  await uploadAudio(userAudioKey, input.audioBuffer, input.mimeType);

  const { transcript, words, durationSec } = await transcribeAudio(
    input.audioBuffer,
    input.mimeType
  );

  const metrics = analyzeSpeech({
    words,
    turnDurationSec: durationSec ?? 1,
  });

  const turnNumber = session.turns.length + 1;

  const userTurn = await prisma.practiceTurn.create({
    data: {
      sessionId: input.sessionId,
      role: "USER",
      clientTurnId: input.clientTurnId,
      transcript,
      metricsJson: metrics,
      audioKey: userAudioKey,
    },
  });

  const coachText = await generateCoachText(
    COACH_SYSTEM_PROMPT,
    buildCoachUserMessage(transcript || "(no speech detected)", metrics, turnNumber)
  );

  let coachAudioUrl: string | undefined;
  let coachAudioKey: string | undefined;
  try {
    const coachAudio = await synthesizeCoachSpeech(coachText);
    coachAudioKey = `practice/${input.userId}/${input.sessionId}/${input.clientTurnId}-coach.mp3`;
    await uploadAudio(coachAudioKey, coachAudio, "audio/mpeg");
    coachAudioUrl = await getSignedUrl(coachAudioKey);
  } catch {
    // TTS failed, coach turn will be text-only
  }

  await prisma.practiceTurn.create({
    data: {
      sessionId: input.sessionId,
      role: "COACH",
      coachText,
      audioKey: coachAudioKey,
    },
  });

  return {
    turnId: userTurn.id,
    transcript,
    words,
    metrics,
    coachText,
    coachAudioUrl,
  };
}

export async function listSessions(userId: string) {
  return prisma.practiceSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      turns: {
        where: { role: "USER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { transcript: true, metricsJson: true },
      },
      _count: { select: { turns: true } },
    },
  });
}

export async function getSessionDetail(userId: string, sessionId: string) {
  return prisma.practiceSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      turns: { orderBy: { createdAt: "asc" } },
    },
  });
}
