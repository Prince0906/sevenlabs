# CI/CD Pipeline

How code gets from a pull request to the running site, and the one-time setup a
maintainer must do in GitHub's UI to make it safe.

There are **two workflows**, split on purpose:

| Workflow | File | Runs on | Sees secrets? | Job |
|---|---|---|---|---|
| **CI** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | every PR (incl. forks) + push to `main` | **No** | Prove the change is correct. |
| **Deploy** | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | push to `main` **only** | **Yes** | Ship the change to production. |

The split is the core safety property: **a contributor's PR (or a fork) can run
the full gate without ever touching a secret**, because the only workflow that
holds secrets (`Deploy`) never runs on a PR or a fork. Reproduce the entire CI
gate locally with `npm run verify`.

---

## Part 1 — What's implemented (no action needed; it's in the repo)

### CI — the contributor gate (`ci.yml`)

Runs on every pull request and every push to `main`. **No secrets**, so it is
safe to run on forks. Five independent checks must be green:

| Check (exact name) | What it proves | Local repro |
|---|---|---|
| **Lint** | ESLint passes — incl. `no-console` (secrets must go through `redact()`). | `npm run lint` |
| **Typecheck** | `tsc --noEmit` compiles the whole repo. | `npm run typecheck` |
| **Tests + coverage gate** | Vitest passes **and** coverage didn't regress (a ratchet — see [`TESTING.md`](TESTING.md)). Uploads `test-reports/` as an artifact for triage. | `npm run test:coverage` |
| **Clean build** | `next build` from a fresh `npm ci` — catches a `HEAD` that imports an untracked file. | `npm run build` |
| **Schema/migration drift** | Replays committed migrations into a throwaway `postgres:16` and diffs against `schema.prisma`. Fails if a `db:push` skipped a migration. | `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` |

Hardening already baked in:
- `permissions: contents: read` — CI can only read the repo.
- `concurrency` cancels superseded runs **on a PR branch only**; `main` runs are
  never cancelled.
- The coverage job runs with `SKIP_ENV_VALIDATION=true` and a dummy
  `DATABASE_URL` so it needs no real environment.

> The check **names** above are load-bearing — branch protection (Part 2) matches
> them as exact strings. Rename a job in `ci.yml` and you must update branch
> protection to match, or the gate silently stops being required.

### Deploy — the maintainer pipeline (`deploy.yml`)

Runs **only** on push to `main`, and every job is additionally guarded by
`if: github.repository == 'Prince0906/sevenlabs'` so a fork that somehow has
`main` pushes can't deploy. Four jobs run in sequence (`needs` chain), ordered so
a failure never half-ships:

1. **Re-gate before deploy** — re-runs `typecheck` + `test:coverage` from the
   exact commit. Belt-and-suspenders: a red `main` physically can't ship even if
   branch protection is ever misconfigured.
2. **Build & push image** — builds the Docker image and pushes it to **GHCR**
   (`ghcr.io/prince0906/sevenlabs:latest` + `:<sha>`). Runs **first** so a build
   failure never touches the prod DB.
3. **Apply DB migrations** — `prisma migrate deploy` + `migrate status` against
   the external Prisma Postgres cloud DB. Runs **after** the image is proven
   buildable but **before** the box restarts, so the schema is current before new
   code serves.
4. **Roll the EC2 box** — gated by the `production` GitHub Environment (the human
   approval step). Asserts the required secrets exist (and
   `KEY_ENCRYPTION_SECRET` ≥ 32 chars), SCPs `docker-compose.yml` + `Caddyfile`
   to the box, writes `.env` under `umask 077`, `docker compose pull && up -d`,
   then **health-checks** `/api/health` for ~90s before declaring success.

Secret-handling properties already in place:
- Secrets reach the box as **named SSH env vars** (`envs:`), never interpolated
  into the script string — so they can't render into a logged command.
- `concurrency: cancel-in-progress: false` — deploys queue, never cancel
  mid-roll (a cancelled roll could leave a pulled-but-not-restarted image).
- `permissions: contents: read, packages: write` — nothing more.
- A code comment warns: **never enable `ACTIONS_STEP_DEBUG`** on this workflow
  (it can surface masked secret values).

Operational runbook for the box itself (first-time provisioning, SSH, Caddy):
[`DEPLOY.md`](DEPLOY.md).

### Governance & supply-chain files (already committed)

| File | Purpose |
|---|---|
| [`LICENSE`](LICENSE) | MIT. |
| [`SECURITY.md`](SECURITY.md) | Private disclosure policy (BYOK/spend/auth aware). |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contributor-facing CI/CD + conventions. |
| [`.github/CODEOWNERS`](.github/CODEOWNERS) | Maintainer owns everything; security-sensitive paths (`crypto.ts`, `byok.ts`, `spend.ts`, auth, `/.github`, `/deploy`, `/prisma`) call for explicit review. |
| [`.github/dependabot.yml`](.github/dependabot.yml) | Weekly npm + **github-actions** update PRs — this is what keeps SHA-pinned actions current once you pin them. |
| [`.github/pull_request_template.md`](.github/pull_request_template.md) | PR checklist. |

### What this pipeline pass fixed (history, for context)

The two-workflow shape above replaced an earlier structure that ran tests twice
and mixed lint into the deploy file. The notable fixes:

- **Removed an arbitrary-commit-execution vector.** A `workflow_dispatch` input
  (`image_sha`) let a chosen commit be rolled to prod *with the production
  secrets* — killed.
- **Reordered `build → migrate → deploy`.** Previously a failed image build could
  still migrate prod, leaving the DB schema ahead of the running code.
- **De-duplicated the test run** and moved **Lint** into `ci.yml` (it was in the
  deploy path).
- **Secret hardening:** SSH `envs:` instead of string interpolation, `.env`
  written under `umask 077`, a fail-fast assert if `KEY_ENCRYPTION_SECRET` is
  missing, and a `/api/health` poll that fails the deploy if the container never
  goes healthy.
- Added `npm run verify` (lint → typecheck → tests+coverage → build, in the exact
  CI env via `cross-env`) — one command that guarantees green CI.

Last verified green: **366 tests pass, coverage thresholds met, build clean**, all
workflow YAML parses.

### Founder defaults baked in (one-line to change if you disagree)

- **License:** MIT under "Prince Sahoo". The real moat is the outcome data, which
  no license protects anyway — relicense the server later if you ever need to
  fence a hosted competitor.
- **Security contact:** [`SECURITY.md`](SECURITY.md) now points reports at
  `security@sevenlabs.tech`. You still need to **create that mailbox/forward** on
  the domain, or reports will bounce.

---

## Part 2 — What you (the maintainer) must do manually

These live in **GitHub settings / your cloud accounts**, not in code, so the repo
can't do them for you. Do them **before** relying on the pipeline or making the
repo public.

### A. Branch protection on `main`

A branch protection rule blocks unsafe changes to `main`: no direct pushes, PRs
can't merge with failing checks, etc. Without it the CI checks still *run* but
aren't *required* — a red PR can still be merged (the Deploy `gate` job is a
backstop, not a replacement). It's optional while the repo is solo/pre-launch,
but set it up before the repo gets real contributor traffic.

**Two gotchas to avoid first:**

1. **Status-check names must match EXACTLY.** Requiring a check name that never
   runs (a typo, or an old name from before the workflow rename) leaves every PR
   stuck on *"Expected — waiting for status to be reported"* and **unmergeable**.
   Add exactly the five names below. They only appear in the picker after CI has
   run at least once on the repo (e.g. on a recent PR).
2. **The solo-maintainer self-approval trap.** If you require a PR **and** set
   *Required approvals ≥ 1*, you lock yourself out — GitHub won't let you approve
   your own PR and there's no one else to. As the sole maintainer set
   **Required approvals = 0** (you still open a PR, but can merge it yourself), or
   add yourself to a bypass list.

**Recommended (light) setup — Settings → Branches → Add branch protection rule:**
- **Branch name pattern:** `main`
- ✅ **Require a pull request before merging**
  - **Required approvals: 0** (avoid the self-approval trap)
  - ⬜ Leave *"Require review from Code Owners"* OFF (CODEOWNERS exists; enabling
    it demands your own approval — same lock-out)
- ✅ **Require status checks to pass before merging** — add these **five**, exact:
  - `Lint`
  - `Typecheck`
  - `Tests + coverage gate`
  - `Clean build`
  - `Schema/migration drift`
  - (optional) ✅ *Require branches to be up to date before merging*
- ⬜ Leave *"Do not allow bypassing the above settings"* OFF for now (keeps an
  admin override; tick it later for strict discipline)

> Newer GitHub UI: the same lives under **Settings → Rules → Rulesets → New branch
> ruleset** (Enforcement: Active; Target: default branch; add the PR + status-check
> rules; add yourself to the Bypass list). Either system works.

**When contributors arrive:** bump *Required approvals* to 1, optionally enable
code-owner review and "include administrators."

### B. Create the `production` Environment

Settings → Environments → **New environment** → name it **`production`** (exact).
- Add **Required reviewers** (yourself) → this is the human approval gate the
  `deploy` job pauses on before it touches the box.
- Optionally restrict it to the `main` branch.

The `deploy` job references `environment: production`; if it doesn't exist, the
job runs with no approval pause.

### C. Add the deploy secrets

Settings → Secrets and variables → **Actions** → repository secrets. The
`Deploy` workflow consumes all of these:

| Secret | Notes |
|---|---|
| `EC2_HOST` | Public IP / hostname of the box. |
| `EC2_SSH_KEY` | Private key for `ec2-user` SSH. |
| `SITE_ADDRESS` | Public hostname for Caddy auto-HTTPS (e.g. `aloud.sevenlabs.tech`); `:80` for IP-only. |
| `AUTH_URL` | Must equal the public `https://` origin, or Auth.js mis-derives the OAuth callback behind Caddy's TLS. |
| `DATABASE_URL` | Prisma Postgres cloud connection string. |
| `OPENAI_API_KEY` | House key (Whisper/GPT/TTS/Realtime + the pinned judge). |
| `DEEPGRAM_API_KEY` | **Optional.** Verbatim ASR for disfluency/fluency metrics; unset ⇒ Whisper fallback (disfluency reads artificially low). |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`). |
| `KEY_ENCRYPTION_SECRET` | BYOK KEK — **≥ 32 chars** or the deploy assert fails and the app's Zod env rejects it. Without it, `/api/keys` returns 503 and BYOK silently dies. |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | Google OAuth. |
| `S3_BUCKET_NAME` · `AWS_REGION` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` | Audio storage. |

### D. Make the GHCR package Public

After the first successful `build` job, the image appears under the repo's
Packages. Set its visibility to **Public**, or the EC2 box can't
`docker compose pull` without authenticating.

### E. Before making the repo public (supply chain)

1. **SHA-pin the third-party actions** in `deploy.yml` — ✅ **done**: each is
   pinned to a 40-char commit SHA with a trailing `# vX.Y.Z` comment
   (`docker/login-action`, `docker/build-push-action`, `appleboy/scp-action`,
   `appleboy/ssh-action`). First-party `actions/*` stay on major tags;
   Dependabot (already configured) keeps the pins current.
2. **Enable Private Vulnerability Reporting** — Settings → Security → enable, so
   `SECURITY.md`'s "report privately" path actually exists.
3. Confirm **`ACTIONS_STEP_DEBUG` is not set** as a secret/variable on the repo.

### F. If you fork or rename the repo

The owner is **hardcoded** in two places — update both or Deploy silently
no-ops / pushes to the wrong image:
- the `if: github.repository == 'Prince0906/sevenlabs'` guard on every Deploy job;
- the GHCR image name is derived from `github.repository` (lowercased) — fine on
  rename, but the box's `docker-compose.yml` default
  (`ghcr.io/prince0906/sevenlabs:latest`) is hardcoded and must match.

The SSH username is `ec2-user` (Amazon Linux). On a different distro/host, change
it in the `scp`/`ssh` steps (or make it a `DEPLOY_USER` secret).

---

## One-glance flow

```
PR opened ─▶ CI (5 checks, no secrets, fork-safe) ─▶ review + approve ─▶ merge to main
                                                                              │
main push ─▶ Deploy:  re-gate ─▶ build+push GHCR ─▶ migrate DB ─▶ [approve] ─▶ roll EC2 ─▶ /api/health ✓
```
