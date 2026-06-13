# Deploying Aloud — cheap single EC2 box on AWS

Replaces the old ECS Fargate + ALB + ECR stack (~$55/mo) with **one Free-Tier
`t3.micro`** running the app as a Docker container behind **Caddy** (TLS).
Postgres stays external (Prisma cloud); no S3. **~$0 for 12 months, then ~$10–15/mo.**

```
GitHub push → Actions (lint → test → prisma migrate deploy → build image →
GHCR) → SSH to EC2 → docker compose pull && up   ──>  Caddy :443 → app :3000
```

## One-time setup

**1. AWS account + IAM user** — use a *real* personal account (not Learner Lab).
Create an IAM user with EC2 permissions; save its access key. Locally:
`aws configure` (or export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`).

**2. SSH key**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/aloud -N ""
```

**3. Provision the box (Terraform)**
```bash
cd terraform
terraform init
terraform apply \
  -var "ssh_public_key=$(cat ~/.ssh/aloud.pub)" \
  -var "admin_ssh_cidr=$(curl -s ifconfig.me)/32"
```
Note the output: **`app_public_ip`** (Elastic IP).

**4. DNS + TLS** (needed for Google OAuth + HTTPS)
- Point your domain's **A record** at `app_public_ip`.
- Set the `SITE_ADDRESS` secret to that domain (e.g. `app.aloud.ai`) → Caddy auto-HTTPS.
- No domain yet? Use `SITE_ADDRESS=:80` (HTTP on the IP). Email/password login works; Google OAuth needs the domain + HTTPS.

**5. GitHub repo secrets** (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `EC2_HOST` | the Elastic IP |
| `EC2_SSH_KEY` | contents of `~/.ssh/aloud` (private key) |
| `SITE_ADDRESS` | your domain, or `:80` |
| `DATABASE_URL` | prod Postgres URL |
| `OPENAI_API_KEY` | OpenAI key |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://<domain>` (or `http://<ip>` interim) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth creds |

> **No AWS/S3 secrets needed** — the interview panel uses no S3. Only set
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET_NAME` if you revive
> the parked Speaking Coach (and provision a bucket yourself).

**6. Make the GHCR image public** — after the first CI run pushes it: GitHub →
Packages → `sevenlabs` → Package settings → visibility **Public** (so the box can
`docker compose pull` without auth).

**7. Google OAuth redirect** — add `https://<domain>/api/auth/callback/google`
to the authorized redirect URIs in Google Cloud Console.

## Deploys
Push to `main`. CI lints, tests, runs `prisma migrate deploy`, builds + pushes
the image to GHCR, then SSHes into the box to pull + restart (~2–4 min).

## Operating the box
- SSH: `terraform output ssh_command`
- Logs: `cd /opt/sevenlabs && docker compose logs -f app`
- Restart: `docker compose restart`

## Cost
`t3.micro` free for 12 months (then ~$7.5/mo) · 20 GB gp3 ~$1.6/mo · EIP free
while attached → **~$0 year 1, ~$9/mo after**. (A *stopped* instance still
holding an EIP costs ~$3.6/mo — keep it running or release the EIP.)

## Tear down the old ECS stack
The previous ALB/ECS/Fargate lived in the AWS Academy Learner Lab — let the lab
expire, or run `terraform destroy` against the pre-`aws-ec2-cheap-deploy` config
in that account to stop credit burn.
