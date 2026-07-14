import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import {
  RESUME_EXTRACTION_PROMPT,
  buildResumeExtractionMessage,
  validateResumeFacts,
  type ResumeFacts,
} from "@sevenlabs/panel-core";
import { resumeFactsSchema } from "@sevenlabs/shared-types";
import { extractResumeJson, ProviderError } from "@/lib/providers/openai";
import {
  parseResumeFile,
  isSupportedResumeType,
  MAX_RESUME_BYTES,
} from "@/lib/resume";
import { checkRateLimit } from "@/lib/interview/spend";

// Below this, the parsed text is noise (an image-only / scanned PDF with no
// embedded text) and extraction would hallucinate — refuse instead.
const MIN_RESUME_CHARS = 80;
const RESUME_RATE_LIMIT = 5;
const RESUME_WINDOW_SEC = 3600;

/** CSRF: same-origin only, matching the mint endpoints. */
function badOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !!(origin && host && new URL(origin).host !== host);
}

/** Upload + parse + extract + validate + store the candidate's resume. One per
 * user (upsert). The interviewer instructions only ever see validated facts. */
export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (badOrigin(request)) {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
    if (!(await checkRateLimit(`resume:user:${userId}`, RESUME_RATE_LIMIT, RESUME_WINDOW_SEC))) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: "Bad file size" }, { status: 400 });
    }
    const mimeType = file.type || "application/pdf";
    if (!isSupportedResumeType(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF or text file." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsed;
    try {
      parsed = await parseResumeFile(buffer, mimeType);
    } catch {
      return NextResponse.json(
        { error: "Could not read that file" },
        { status: 422 }
      );
    }
    if (parsed.text.length < MIN_RESUME_CHARS) {
      return NextResponse.json(
        { error: "No readable text found. If this is a scanned PDF, paste the text instead." },
        { status: 422 }
      );
    }

    let raw: unknown;
    try {
      raw = await extractResumeJson(
        RESUME_EXTRACTION_PROMPT,
        buildResumeExtractionMessage(parsed.text)
      );
    } catch (e) {
      log.error("resume extraction failed", {
        userId,
        status: e instanceof ProviderError ? e.status : 0,
      });
      return NextResponse.json(
        { error: "Could not analyze the resume, try again" },
        { status: 502 }
      );
    }

    const facts = validateResumeFacts(raw as ResumeFacts, parsed.text);
    if (facts.facts.length === 0 && !facts.headline) {
      return NextResponse.json(
        { error: "Could not extract anything useful from that resume" },
        { status: 422 }
      );
    }
    // D11: assert the validated facts satisfy the stored contract before
    // persisting, so the column can only ever hold schema-valid grounding data
    // (symmetric with the read-side parse in resume-digest.ts). validateResumeFacts
    // already produces this shape, so this is a defense-in-depth assertion.
    const storedFacts = resumeFactsSchema.parse(facts);

    await prisma.resumeProfile.upsert({
      where: { userId },
      create: {
        userId,
        factsJson: storedFacts as unknown as Prisma.InputJsonValue,
        sourceText: parsed.text,
      },
      update: {
        factsJson: storedFacts as unknown as Prisma.InputJsonValue,
        sourceText: parsed.text,
      },
    });

    return NextResponse.json({
      ok: true,
      headline: facts.headline ?? null,
      factCount: facts.facts.length,
      truncated: parsed.truncated,
    });
  } catch (err) {
    log.error("[POST /api/resume]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Current profile summary for the green-room ("Interviewing against: …"). */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profile = await prisma.resumeProfile.findUnique({
      where: { userId },
      select: { factsJson: true, extractedAt: true },
    });
    if (!profile) {
      return NextResponse.json({ exists: false });
    }
    // D11: parse on read here too — a malformed blob yields a null summary rather
    // than a thrown cast (display path, so fail soft).
    const parsedFacts = resumeFactsSchema.safeParse(profile.factsJson);
    const facts = parsedFacts.success ? parsedFacts.data : null;
    return NextResponse.json({
      exists: true,
      headline: facts?.headline ?? null,
      factCount: facts?.facts?.length ?? 0,
      extractedAt: profile.extractedAt,
    });
  } catch (err) {
    log.error("[GET /api/resume]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Remove the stored resume (user-initiated, hard delete). */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (badOrigin(request)) {
      return NextResponse.json({ error: "Bad origin" }, { status: 403 });
    }
    await prisma.resumeProfile.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[DELETE /api/resume]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
