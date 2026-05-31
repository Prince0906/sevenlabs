---
title: Deployment
tags: [architecture]
updated: 2026-06-01
---

# Deployment

Moved **off** the old ECS Fargate + ALB + ECR stack (~$55/mo) onto **one Free-Tier `t3.micro`** running the app as a Docker container behind **Caddy** (auto-HTTPS/TLS) on AWS. **~$0 for 12 months, then ~$9/mo.** Postgres stays external; audio stays in S3. Branch `aws-ec2-cheap-deploy`; runbook in `DEPLOY.md`. Rationale: zero users today → minimize cost but stay on AWS.

## Pipeline
`git push main → GitHub Actions (lint → test → prisma migrate deploy → build image → push GHCR) → SSH to EC2 → docker compose pull && up → Caddy :443 → app :3000`. Provisioned by Terraform (`terraform/`: single EC2 + Elastic IP).

> Note: **Prisma migrations now run in CI** here (`prisma migrate deploy`). Older `CLAUDE.md` text says migrations are manual — `DEPLOY.md` is newer and authoritative.

## Env
`SKIP_ENV_VALIDATION=true` bypasses the Zod-validated `src/lib/env.ts` (CI sets it for `test:ci`; the Dockerfile for `next build`). Email/password login works on `:80`; **Google OAuth needs the domain + HTTPS** (a launch dependency — see [[Security]]). Set `OPENAI_REALTIME_MODEL` to a GA id (see [[OpenAI Realtime API]]).

## Status
Going live is **[[Roadmap|Phase 0]]** — the single biggest blocker on all product learning.

## Related
[[Architecture Overview]] · [[Security]] · [[Tech Stack]] · [[Roadmap]]
