# Deploy runbook

Deployment, end to end — this is the **only** place it's documented. Prod is
**one Free-Tier EC2 `t3.micro`** (Amazon Linux 2023, Elastic IP) running the app
as a Docker container behind **Caddy** (auto-HTTPS). Postgres is external
(Prisma Postgres cloud). No S3, no ALB, no ECS. **~$0 year 1, ~$9/mo after.**

```
PR ─▶ CI (5 checks, no secrets, fork-safe) ─▶ merge to main
                                                   │
main push ─▶ Deploy: re-gate ─▶ build+push GHCR ─▶ migrate DB ─▶ [approve] ─▶ roll EC2 ─▶ /api/health ✓
```

## 1. The two workflows

| Workflow | File | Runs on | Secrets? | Job |
|---|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | every PR (incl. forks) + push to `main` | **No** | Prove the change is correct. |
| **Deploy** | `.github/workflows/deploy.yml` | push to `main` only | **Yes** | Ship it. |

The split is the safety property: the only workflow holding secrets never runs
on a PR or fork. Reproduce the whole CI gate locally with `npm run verify`.

**CI — five independent checks** (names are load-bearing; branch protection
matches them as exact strings): `Lint`, `Typecheck`, `Tests + coverage gate`
(ratchet — [docs/testing.md](../testing.md)), `Clean build` (fresh `npm ci` +
`next build`; catches HEAD importing an untracked file), `Schema/migration
drift` (replays migrations into a throwaway `postgres:16`, diffs against
`schema.prisma`).

**Deploy — four jobs in a `needs` chain**, each guarded by
`if: github.repository == 'Prince0906/sevenlabs'`:
1. **Re-gate** — re-runs typecheck + tests from the exact commit.
2. **Build & push** — Docker image → GHCR (`ghcr.io/prince0906/sevenlabs:latest`
   + `:<sha>`). Runs before migrate so a build failure never touches prod DB.
3. **Migrate** — `prisma migrate deploy` + `migrate status` against the cloud
   DB, before the box restarts (schema current before new code serves).
4. **Roll the box** — pauses on the `production` GitHub Environment (human
   approval), asserts required secrets exist (`KEY_ENCRYPTION_SECRET` ≥ 32
   chars), SCPs `deploy/docker-compose.yml` + `deploy/Caddyfile`, writes `.env`
   under `umask 077`, `docker compose pull && up -d`, then polls `/api/health`
   for ~90s.

Hardening in place: secrets reach the box as named SSH `envs:` (never
interpolated into script strings); deploys queue, never cancel mid-roll;
third-party actions SHA-pinned (Dependabot keeps pins current); never enable
`ACTIONS_STEP_DEBUG` on this repo.

## 2. One-time provisioning

1. **AWS + IAM user** with EC2 permissions; `aws configure` locally.
2. **SSH key**: `ssh-keygen -t ed25519 -f ~/.ssh/aloud -N ""`
3. **Box (Terraform)**:
   ```bash
   cd terraform && terraform init && terraform apply \
     -var "ssh_public_key=$(cat ~/.ssh/aloud.pub)" \
     -var "admin_ssh_cidr=$(curl -s ifconfig.me)/32"
   ```
   Note the `app_public_ip` output (Elastic IP). Terraform state is local-only.
4. **DNS + TLS**: point the domain's A record at `app_public_ip`; set
   `SITE_ADDRESS` to the domain → Caddy auto-HTTPS. (No domain: `SITE_ADDRESS=:80`;
   Google OAuth needs the domain + HTTPS.)
5. **Google OAuth redirect**: add `https://<domain>/api/auth/callback/google`
   in Google Cloud Console.
6. **GHCR visibility**: after the first `build` job, set the package to
   **Public** (or the box can't `docker compose pull` unauthenticated).

## 3. GitHub settings (Settings → …)

**Secrets** (Secrets and variables → Actions):

| Secret | Notes |
|---|---|
| `EC2_HOST` | the Elastic IP / hostname |
| `EC2_SSH_KEY` | private key for `ec2-user` |
| `SITE_ADDRESS` | public hostname for Caddy (e.g. `aloud.sevenlabs.tech`); `:80` for IP-only |
| `AUTH_URL` | must equal the public `https://` origin or OAuth mis-derives behind TLS |
| `DATABASE_URL` | Prisma Postgres cloud connection string |
| `OPENAI_API_KEY` | house key (realtime mint fallback + pinned judge + Whisper fallback + resume extraction) |
| `DEEPGRAM_API_KEY` | optional; unset ⇒ Whisper fallback and disfluency reads artificially low |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `KEY_ENCRYPTION_SECRET` | BYOK KEK, **≥ 32 chars** (deploy asserts). Unset ⇒ `/api/keys` 503s and BYOK is dead |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | OAuth |

**`production` Environment** (Environments → New): name it exactly
`production`, add yourself as required reviewer — this is the human approval
gate the roll job pauses on. Without it the job runs unpaused.

**Branch protection on `main`** (optional while solo, required before real
contributors): require a PR + the five CI check names above, **Required
approvals = 0** (the solo self-approval trap: requiring 1 locks you out).
Leave code-owner review off for the same reason.

**Before making the repo public**: enable Private Vulnerability Reporting
(SECURITY.md's path), confirm `ACTIONS_STEP_DEBUG` is not set, and create the
`security@sevenlabs.tech` mailbox SECURITY.md points at.

## 4. Day-2 operations

- Deploy = push to `main` (~2–4 min after approval).
- SSH: `terraform output ssh_command`
- Logs: `cd /opt/sevenlabs && docker compose logs -f app`
- Restart: `cd /opt/sevenlabs && docker compose restart`

## 5. Cost

`t3.micro` free 12 months (then ~$7.5/mo) · 20 GB gp3 ~$1.6/mo · EIP free while
attached → **~$0 year 1, ~$9/mo after**. A *stopped* instance holding an EIP
still costs ~$3.6/mo — keep it running or release the EIP.

## 6. Fork / rename caveats

The owner is hardcoded in two places — update both or Deploy silently no-ops /
pushes to the wrong image:
- the `if: github.repository == 'Prince0906/sevenlabs'` guard on every Deploy job;
- the box's `deploy/docker-compose.yml` default image
  (`ghcr.io/prince0906/sevenlabs:latest`) — the workflow derives the image from
  `github.repository`, but the compose default must match.

SSH username is `ec2-user` (Amazon Linux); change it in the scp/ssh steps for a
different distro. The box path `/opt/sevenlabs` appears in `deploy.yml` and the
ops commands above.
