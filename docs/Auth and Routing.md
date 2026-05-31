---
title: Auth and Routing
tags: [architecture]
updated: 2026-06-01
---

# Auth and Routing

**Auth.js v5 (NextAuth beta)** + Prisma adapter + **JWT** session strategy (the Credentials provider can't use database sessions).

## Split config
- `src/auth.config.ts` — **edge-safe**: the Google provider + the `authorized` routing callback + jwt/session callbacks that inject `user.id` from `token.sub`.
- `src/lib/auth.ts` — adds the **Prisma adapter** + JWT strategy + the **Credentials** provider (email/password, bcrypt, lowercased email; returns `null` for Google-only users with no `passwordHash`).

Providers: **Google OAuth** (`allowDangerousEmailAccountLinking: true` — Google verifies email) and **Credentials**.

## Routing / enforcement
Enforcement lives in the `authorized` callback (there is **no `src/middleware.ts`** today, despite older docs referencing one — a planned CSP-nonce middleware is a launch task in [[Security]]). Public routes:
- `/` (**exact match** — the public marketing landing)
- `/sign-in`, `/sign-up`, `/api/auth/*`, `/api/health`

Everything else requires `auth.user`. Authenticated users hitting `/` redirect to `/dashboard` (the dashboard moved off `/` in the redesign).

## Related
[[Architecture Overview]] · [[Security]] · [[Data Model]]
