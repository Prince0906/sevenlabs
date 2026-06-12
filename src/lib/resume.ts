import { extractText, getDocumentProxy } from "unpdf";

// ~3-4 dense pages. Bounds the extraction call's input cost and stops a
// pathological upload from blowing the context window. INTERVIEW_ENGINE_PLAN §14.1.
export const MAX_RESUME_CHARS = 20_000;
// A resume is text — 2 MB is already a huge PDF. Guards the parse step.
export const MAX_RESUME_BYTES = 2 * 1024 * 1024;

// Non-printable control chars PDFs sometimes embed. Excludes tab (u0009) and
// newline (u000A), which carry the resume's line/section structure.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export interface ParsedResume {
  text: string;
  truncated: boolean;
}

/** Light normalization: strip control chars, collapse trailing spaces and 3+
 * blank lines, trim. Keeps line structure the extractor benefits from. */
function normalizeWhitespace(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract plain text from an uploaded resume. PDF goes through unpdf (pure-JS
 * pdf.js — no native binary on the box); text/markdown is read directly. The
 * caller has already size-checked; this caps the EXTRACTED text length so a
 * text-heavy PDF can't exceed the budget.
 */
export async function parseResumeFile(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedResume> {
  let text: string;
  if (mimeType.includes("pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    text = Array.isArray(extracted.text)
      ? extracted.text.join("\n")
      : extracted.text;
  } else {
    text = buffer.toString("utf-8");
  }

  text = normalizeWhitespace(text);
  const truncated = text.length > MAX_RESUME_CHARS;
  return {
    text: truncated ? text.slice(0, MAX_RESUME_CHARS) : text,
    truncated,
  };
}

/** True for the upload types we parse: PDF, plain text, markdown. */
export function isSupportedResumeType(mimeType: string): boolean {
  return (
    mimeType.includes("pdf") ||
    mimeType.includes("text/plain") ||
    mimeType.includes("markdown") ||
    mimeType === "text/md"
  );
}
