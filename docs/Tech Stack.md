---
title: Tech Stack
tags: [architecture]
updated: 2026-06-01
---

# Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, `output: "standalone"`) | single Node process; route groups `(dashboard)` |
| Language | TypeScript, React 19 | React-Compiler ESLint rule (no ref reads/writes during render) |
| Monorepo | npm workspaces | `packages/coach-core` (pure analysis/prompt, no I/O) · `packages/shared-types` (Zod schemas) |
| DB / ORM | Postgres + **Prisma 7** | new `prisma-client` generator → `@/generated/prisma`; see [[Data Model]] |
| Auth | **Auth.js v5** + Prisma adapter + JWT | Google + Credentials; see [[Auth and Routing]] |
| AI | **OpenAI via raw `fetch`** (not the SDK) | Realtime (panel), Whisper + `gpt-4o-mini` + `tts-1` (coach), pinned `gpt-4o-mini` (judgment) |
| Voice transport | WebRTC, browser⇄OpenAI | [[OpenAI Realtime API]] · [[Realtime Panel]] |
| Browser VAD | `@ricky0123/vad-web` (Silero) | assets in `public/vad/` ([[Speaking Coach]]) |
| Storage | S3 | audio + transcripts |
| Styling | **Tailwind v4** (CSS-first) + shadcn | forced-dark; [[Design System]] |
| Fonts | Fraunces + Hanken Grotesk + Geist Mono | next/font |
| Motion | framer-motion | panel presences, verdict reveal |
| Tests | **Vitest** | aliases resolve `@sevenlabs/*` to source |
| Deploy | Docker + Caddy on EC2, Terraform, GH Actions | [[Deployment]] |

## Workspace logic split
Pure, testable logic (speech analysis, prompts, rubric shapes) lives in `packages/coach-core`; I/O-bound pipelines (Prisma/S3/OpenAI) stay in `src/lib/`. This is why the [[Judgment Pipeline]] and [[Speaking Coach]] can reuse the same `analyzeSpeech` / rubric code.

## Related
[[Architecture Overview]] · [[Data Model]] · [[Design System]] · [[Deployment]] · [[OpenAI Realtime API]]
