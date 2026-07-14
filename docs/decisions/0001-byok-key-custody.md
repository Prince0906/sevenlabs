# ADR-0001: BYOK keys are custodied server-side at rest

- Status: Accepted (2026-06-11)

## Context
Users may paste their own OpenAI key so long sessions run on their dime.
Alternatives: browser-memory passthrough (key re-sent per mint) or server-side
encrypted storage. Passthrough resurrects the XSS blast radius and multiplies
network exposure of a billing-enabled secret.

## Decision
Server-side custody: AES-256-GCM under a dedicated `KEY_ENCRYPTION_SECRET` env
KEK. The raw key transits the server **exactly once** (`POST /api/keys`);
thereafter only ciphertext exists; decryption happens only inside the
mint/validate call frame. No read-back endpoint — display is `last4` +
fingerprint; revoke = hard delete. `dekVersion` column is ready so a KMS
envelope (per-record DEKs) can land before paying users without a migration.

## Consequences
TLS on the box is a hard prerequisite. When the KEK is unset, `/api/keys`
returns 503 and everything runs on the house key (fail-closed). The single
static KEK is a known whole-DB blast radius accepted until paying users — the
KMS upgrade is deliberately deferred, not forgotten.
