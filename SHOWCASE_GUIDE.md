# 🎓 SevenLabs DevOps — Showcase Guide

This guide walks you through exactly what to show your tutor and how to find everything.

---

## 1. Finding Your Deployed App URL

After the pipeline runs successfully, your app is accessible via the **Application Load Balancer DNS name**.

### Option A: From GitHub Actions Logs
1. Go to your repo → **Actions** tab → click the latest successful run
2. Click the **"Phase 2 - Infrastructure (Terraform)"** job
3. Expand the **"Terraform Apply"** step
4. Scroll to the bottom — you'll see:
   ```
   Outputs:
   alb_dns_name = "sevenlabs-alb-XXXXXXXXX.us-east-1.elb.amazonaws.com"
   ```
5. Open that URL in your browser: `http://sevenlabs-alb-XXXXXXXXX.us-east-1.elb.amazonaws.com`

### Option B: From AWS Console
1. Go to **AWS Console** → **EC2** → **Load Balancers** (left sidebar)
2. Find `sevenlabs-alb`
3. Copy the **DNS name** from the Description tab
4. Open it in the browser

> **IMPORTANT:** The URL uses `http://` not `https://` (no SSL since we don't have a domain name).
> It may take 2-3 minutes after deployment for the ALB to register the container as healthy.

---

## 2. What to Show in GitHub

### 2a. CI/CD Pipeline (Actions Tab)
Go to: `https://github.com/Prince0906/sevenlabs/actions`

Show the **4-phase pipeline** running automatically on push:

| Phase | Job Name | What It Does |
|-------|----------|-------------|
| 1a | **Lint** | ESLint code quality check — fails if code is bad |
| 1b | **Tests** | Runs 45 unit + integration tests, generates JUnit report |
| 2 | **Infrastructure** | Terraform init → validate → plan → apply |
| 2.5 | **DB migrations** | `prisma migrate deploy` applies any new migrations to the prod DB before the new image goes live |
| 3 | **Deploy** | Docker build → push to ECR → deploy to ECS Fargate |

**Key thing to demonstrate:** Push a small commit (like editing a comment in any file) and show the pipeline auto-triggering.

### 2b. Test Report (Checks Tab)
1. Click on any commit or the Actions run
2. Look for the **"Vitest Results"** check
3. Click it — it shows a beautiful table of all 45 tests with ✅/❌ status

### 2c. GitHub Secrets
Go to: **Settings** → **Secrets and Variables** → **Actions**

Show that all credentials are stored securely (values are hidden):

**AWS / infra**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`

**Database & external APIs**
- `DATABASE_URL` — Postgres connection string (hosted on Prisma Data Platform)
- `REPLICATE_API_TOKEN` — TTS via Chatterbox model
- `OPENAI_API_KEY` — Whisper (transcription) + GPT (coach feedback) + TTS (coach voice)

**Auth.js (sign-in)**
- `AUTH_SECRET` — JWT signing secret (`openssl rand -base64 32`)
- `AUTH_URL` — public base URL (the ALB DNS for prod)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth credentials from Google Cloud Console

---

## 3. What to Show in AWS Console

### 3a. S3 Bucket (Storage)
**Console path:** AWS → S3

Show the bucket `sevenlabs-audio-XXXXX` and highlight:
- ✅ **Versioning:** Click the bucket → **Properties** tab → Bucket Versioning = **Enabled**
- ✅ **Encryption:** Properties tab → Default encryption = **SSE-S3 (AES-256)**
- ✅ **Public Access Blocked:** Click **Permissions** tab → Block public access = **On** (all 4 checkboxes)

### 3b. ECR Repository (Docker Images)
**Console path:** AWS → ECR → Repositories

Show `sevenlabs-repo`:
- Click into it to see pushed Docker images
- Each image is tagged with the **Git commit SHA** (e.g., `abc123def`) + `latest`
- Show that **Scan on push** is enabled (security scanning)

### 3c. ECS Cluster (Running Container)
**Console path:** AWS → ECS → Clusters

Show `sevenlabs-cluster`:
1. Click the cluster → **Services** tab → `sevenlabs-service`
2. Show:
   - **Status:** ACTIVE
   - **Running count:** 1
   - **Launch type:** FARGATE
3. Click the **Tasks** tab → click the running task
4. Show:
   - **Last status:** RUNNING
   - **Health status:** HEALTHY
   - **Container image:** Points to ECR with the commit SHA
   - **Logs** tab: Shows the Next.js app starting up

### 3d. Load Balancer (Networking)
**Console path:** AWS → EC2 → Load Balancers

Show `sevenlabs-alb`:
- **Type:** Application Load Balancer
- **Scheme:** internet-facing
- **Listeners:** HTTP:80 forwarding to target group
- Click **Target Groups** → `sevenlabs-tg` → **Targets** tab → Health status = **healthy**

---

## 4. Demo Script (What to Do Live)

Here's the exact demo flow for your tutor:

### Step 1: Show the Code (2 min)
- Show the `Dockerfile` — point out the 3 stages, non-root user, healthcheck
- Show `terraform/` — point out S3 config (versioning, encryption, public block)
- Show `.github/workflows/deploy.yml` — walk through the 3 phases

### Step 2: Trigger the Pipeline (1 min)
- Make a tiny code change (e.g., update a comment)
- `git add . && git commit -m "demo: trigger pipeline" && git push`
- Switch to GitHub Actions tab and watch it start

### Step 3: Show AWS Resources While Pipeline Runs (3 min)
- While the pipeline is running, switch to AWS Console
- Show S3 bucket properties (versioning ✅, encryption ✅, public block ✅)
- Show ECR repo with existing images
- Show ECS cluster with running service

### Step 4: Show Pipeline Completion (2 min)
- Switch back to GitHub Actions
- Show all 3 phases completed with green checkmarks ✅
- Click "Vitest Results" to show the test report
- Show Terraform Apply output (resources created/updated)

### Step 5: Open the Deployed App (2 min)
- Copy the ALB DNS from Terraform output
- Open in browser — you'll land on the sign-in page
- Sign up with email/password (or Google) — Auth.js creates a `User` row in Postgres
- Show the dashboard, then walk through one feature live:
  - **Text-to-Speech:** type a prompt → generate → audio plays back from a pre-signed S3 URL
  - **Practice (speaking coach):** click "Start practice" → speak for ~10s → get back transcript, WPM/filler-word metrics, and a spoken coach reply — all generated by OpenAI (Whisper → GPT → TTS) running inside the web container

---

## 5. Quick Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| ALB shows 503 | Container not healthy yet | Wait 2-3 minutes for health check to pass |
| Pipeline fails at Terraform | Session token expired | Update `AWS_SESSION_TOKEN` in GitHub Secrets |
| Pipeline fails at "Phase 2.5 - DB migrations" | `DATABASE_URL` secret missing or DB unreachable | Verify the `DATABASE_URL` secret; check that Prisma Data Platform is up |
| Google sign-in returns "redirect_uri_mismatch" | OAuth redirect URI not registered | Google Cloud Console → Credentials → add `http://<alb-dns>/api/auth/callback/google` |
| Sign-in page redirects in a loop | `AUTH_URL` doesn't match the public URL | Set `AUTH_URL` secret to the ALB DNS (with `http://`) |
| ECS task keeps restarting | Missing env vars | Check CloudWatch Logs: AWS → CloudWatch → Log Groups → `/ecs/sevenlabs` |
| Can't access ALB URL | Security group issue | Check EC2 → Security Groups → `sevenlabs-alb-sg` allows port 80 |

---

## 6. Grading Criteria Checklist

| Requirement | Status | Where to Find |
|-------------|--------|--------------|
| GitHub Secrets configured | ✅ | Settings → Secrets → Actions |
| Unit & integration tests | ✅ | 45 tests across 8 suites |
| DB migrations in CI | ✅ | Phase 2.5: `prisma migrate deploy` runs before the new image deploys |
| Test reports generated | ✅ | JUnit XML + visual "Vitest Results" check |
| Terraform init | ✅ | Phase 2 logs |
| Terraform validate | ✅ | Phase 2 logs |
| Terraform plan & apply | ✅ | Phase 2 logs |
| S3: Unique bucket name | ✅ | `sevenlabs-audio-XXXXX` (random suffix) |
| S3: Versioning enabled | ✅ | S3 → Properties |
| S3: Encryption enabled | ✅ | S3 → Properties → AES-256 |
| S3: Public access blocked | ✅ | S3 → Permissions → All 4 blocks ON |
| Docker: Multi-stage build | ✅ | 3 stages: deps → builder → runner |
| Docker: Non-root user | ✅ | `USER nextjs` (UID 1001) |
| Docker: Healthcheck | ✅ | `wget` to `/api/health` |
| Push image to ECR | ✅ | Phase 3 logs |
| Deploy to ECS Fargate | ✅ | Phase 3 logs |
| Verify service running | ✅ | `aws ecs wait services-stable` step |

---

## 7. How to Explain the Terraform & S3 Code (Talking Points)

If your tutor asks you to explain the Terraform code and how it meets the exact project requirements, here is your script.

### Explaining the Pipeline Steps

When looking at the GitHub Actions logs (`deploy.yml`):
*   **"First, I initialize Terraform (`terraform init`)."** This downloads the necessary AWS plugins and connects to our remote S3 state file. The state file is how Terraform remembers what it has already built so it doesn't build duplicates.
*   **"Next, I validate the configuration (`terraform validate`)."** This is an automated check that ensures there are no syntax errors in the code before attempting to deploy.
*   **"Then, I plan the infrastructure (`terraform plan`)."** This creates a dry-run report. It compares my code to what's currently in AWS and calculates exactly what needs to be created or changed.
*   **"Finally, I apply the infrastructure (`terraform apply`)."** This takes the plan and executes it, actually building the resources on AWS.

### Explaining the S3 Bucket Requirements

When showing the code in `terraform/s3.tf`:

**1. Unique Bucket Name**
```hcl
resource "aws_s3_bucket" "audio_bucket" {
  bucket_prefix = "sevenlabs-audio-"
}
```
*   *Explanation:* "S3 bucket names must be globally unique across all of AWS. Instead of hardcoding a name that might fail if someone else took it, I used `bucket_prefix`. Terraform automatically appends random characters to the end, guaranteeing a unique bucket."

**2. Versioning Enabled**
```hcl
resource "aws_s3_bucket_versioning" "audio_bucket_versioning" {
  bucket = aws_s3_bucket.audio_bucket.id
  versioning_configuration { status = "Enabled" }
}
```
*   *Explanation:* "I enabled versioning as a backup mechanism. If an audio file is accidentally deleted or overwritten, AWS keeps the historical versions so data is never permanently lost."

**3. Encryption Enabled**
```hcl
resource "aws_s3_bucket_server_side_encryption_configuration" "audio_bucket_encryption" {
  # ...
  sse_algorithm = "AES256"
}
```
*   *Explanation:* "For data security, I configured the bucket to automatically apply `AES256` Server-Side Encryption (SSE-S3). All audio files are encrypted at rest."

**4. Public Access Blocked**
```hcl
resource "aws_s3_bucket_public_access_block" "audio_bucket_public_access" {
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```
*   *Explanation:* "I applied a strict Public Access Block, turning on all four AWS security guardrails. The bucket is completely private. The only way users hear audio is because my Next.js backend generates secure, temporary, pre-signed URLs."
