# ADR-0003: v1 provider scope is OpenAI only; custom base URLs do not exist

- Status: Accepted (2026-06-11)

## Context
BYOK invites "support every provider" scope creep: Gemini Live, Anthropic,
OpenRouter/Groq via custom base URLs. A user-supplied base URL is an SSRF
primitive into the VPC/instance metadata.

## Decision
v1 realtime BYOK = **OpenAI only**, with pinned hostnames. The provider enum
(`OPENAI | GEMINI | ANTHROPIC`) exists in the schema for later, but custom base
URLs / OpenRouter / Groq **do not exist in v1**. Gemini Live is a
feature-flagged spike with exit criteria, not a launch tier.

## Consequences
One realtime integration to harden instead of three. The SSRF class is
designed out rather than mitigated. Revisit only on real user demand.
