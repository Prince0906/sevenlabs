# Security Policy

Aloud handles sensitive data: user accounts, session audio, and — most
critically — **users' own OpenAI API keys (BYOK)**, which are billing-enabled.
These keys are encrypted at rest with AES-256-GCM and are never echoed back. We
take reports against this surface seriously.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately, in order of preference:

1. **GitHub Private Vulnerability Reporting** — repository **Security** tab ->
   **Report a vulnerability**. This opens an advisory visible only to you and
   the maintainers. (This is the primary path.)
2. If you can't use that flow, email **security@sevenlabs.tech** with `SECURITY`
   in the subject.

Please include: what you found, the affected file/route or endpoint, steps to
reproduce, and the impact. A proof-of-concept helps but isn't required.

**Response targets** (best-effort, single-maintainer project):

- Acknowledgement within **3 business days**.
- Initial assessment and severity within **7 business days**.
- Updates through the advisory; credit on disclosure unless you ask otherwise.

Please give us a reasonable window to ship a fix before any public disclosure.

## In scope

- **BYOK key custody** — encryption, the once-through key path, the absence of
  any read-back, key leakage in logs, responses, or error stacks.
- **Authentication & authorization** — Auth.js flows, session handling, and any
  query that returns another user's data (everything must be userId-scoped).
- **Spend / billing abuse** — bypassing spend reservations, the daily cap, or
  rate limits to run up cost on a house or user key.
- **Secret exposure** — anything surfacing `OPENAI_API_KEY`,
  `KEY_ENCRYPTION_SECRET`, `AUTH_SECRET`, or DB / AWS credentials.
- **Injection** — prompt injection that breaks resume grounding or turn control,
  plus the usual SQLi / XSS / SSRF.

## Out of scope

- Third-party dependency CVEs that already have a pending Dependabot update
  (report upstream).
- Findings requiring a compromised host, a malicious npm package you installed,
  or physical access to the deploy box.
- Best-practice / hardening suggestions with no concrete exploit — open a normal
  issue or PR.
- Denial of service via raw traffic volume against the single deploy instance.

## Confirmed BYOK key exposure

If a report confirms that encrypted, billing-enabled BYOK keys could be
recovered, we will mass-revoke (hard-delete) the affected `ProviderKey` rows and
notify the affected users, in addition to shipping the fix.

## Supported versions

This is a single-deployment application, not a distributed library. **Only the
latest `main` (and the live deployment built from it) is supported.** Fixes land
on `main`; there are no backports.
