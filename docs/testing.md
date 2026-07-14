# Testing standard

How Aloud tests. This is the contract every test follows — the taxonomy, where
tests live, what to mock, what must always be covered, and what we deliberately
don't test. Runner: **Vitest** (`vitest.config.ts`). CI gate: **`.github/workflows/ci.yml` → "Tests + coverage gate"**.

> One-line philosophy: **push logic down into pure functions and test it there;
> mock only at the I/O boundary; never let a high-stakes invariant go unnamed.**

---

## 1. The layers (the pyramid)

Four layers, base-heavy. A behavior is tested at the **lowest** layer that can
express it.

| Layer | Where | What it tests | Mocks? |
|---|---|---|---|
| **L1 · Pure unit** | `packages/*/src/__tests__/`; app-side pure engines (FSM/queue/event-mapper) in `src/__tests__/unit/` | Pure functions, reducers, schemas-as-logic. No I/O. The bulk of the suite. | **None** |
| **L2 · Handler-integration** | `src/__tests__/unit/*-route.test.ts` | API route handlers end-to-end against **mocked adapters** — status codes, guard rails (auth/CSRF/rate-limit/TLS), happy path, security invariants. | I/O boundary only |
| **L3 · Contract** | colocated with L1 (e.g. `outcome-schema.test.ts`) | Zod schemas: parse-accepts the valid shape, parse-rejects the invalid one. The wire contract. | None |
| **L4 · Build / typecheck** | `src/__tests__/integration/build.test.ts` | `tsc --noEmit` compiles — catches a HEAD that imports an untracked/broken file. | n/a |
| **(L5 · Live/E2E)** | manual | A human completes a 3-seat panel; resume → intro → handoff → report. **Not automated.** | — |

> Naming note: the `__tests__/unit/*-route.test.ts` files are **L2 handler-integration**, not pure units — they mock Prisma/auth/OpenAI. The folder name is historical; the `-route` suffix is the real signal.

---

## 2. Running tests

```bash
npm test              # vitest run — the whole suite, one-shot
npm run test:watch    # watch mode while developing
npm run test:coverage # suite + coverage gate (what CI runs)
npx vitest run path/to/file.test.ts          # one file
npx vitest run -t "name of the test"         # by name
```

`SKIP_ENV_VALIDATION=true` is set by `test:ci`; locally the Zod env in
`src/lib/env.ts` is bypassed the same way (or supply a complete `.env`).

---

## 3. Naming & location

- One test file per unit/route, suffix **`.test.ts`**. **Two homes**: package
  tests live in the package (`packages/*/src/__tests__/`); ALL app-side tests
  live in `src/__tests__/{unit,integration}/` — never inside `src/features/`.
- Route handler tests end in **`-route.test.ts`**.
- `describe("<unit/route under test>")` → `it("does X when Y")`, behavior in the
  present tense. One behavior per `it`; table-driven repetition via `it.each`.
- **No logic in tests** — no conditionals/loops that compute the expected value.
  Arrange–Act–Assert, the assertion is literal.

---

## 4. Mocking policy — boundary only

**Mock at the I/O boundary; never mock the thing under test, and never mock pure
logic.** A route test that mocks `@sevenlabs/panel-core` is testing the mock, not
the validation — keep panel-core **real** so route tests exercise the real
anti-hallucination filter, redaction, spend math, etc.

The boundary modules (and only these) get `vi.mock`'d in L2 tests:

| Module | Why it's the boundary |
|---|---|
| `@/lib/db` (Prisma) | the database |
| `@/lib/auth` | the session |
| `@/lib/log` | stdout |
| `@/lib/providers/openai` | OpenAI HTTP |
| `@/lib/providers/deepgram` | Deepgram HTTP |
| `@/lib/interview/spend` | the shared rate-limit/reservation surface, when not under test |
| `@/lib/crypto`, `@/lib/byok` | when testing a *route* that uses them (their own logic is L1-tested) |

The canonical pattern (see `src/__tests__/unit/keys-route.test.ts`):

```ts
const mockPrisma = vi.hoisted(() => ({ providerKey: { upsert: vi.fn() /* … */ } }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// panel-core stays REAL — the real validateResumeFacts / redact runs.
import { POST } from "@/app/api/keys/route";
```

---

## 5. Determinism

- **Inject time.** Functions take `nowMs`/timestamps as parameters (e.g.
  `validateKeyViaMint(key, nowMs)`); tests pass a fixed value. Never assert on a
  live `Date.now()`.
- **No `Math.random()` in assertions.** Seeded/deterministic derivations only
  (e.g. `pickSeatOpener` hashes the session id — same input, same output).
- Tests must pass in any order and in isolation (`vi.clearAllMocks()` in
  `beforeEach`).

---

## 6. The invariant contract (must always be covered)

These are the high-stakes behaviors. **Each must have a named, owned test** — if
you change code that touches one, the test moves with it. Removing one of these
without a replacement is a review-blocking change.

| Invariant | Owning test(s) |
|---|---|
| Every user-data query is `userId`-scoped (no IDOR) | the `*-route` tests (each asserts the `where` includes `userId`) |
| Secrets redacted from logs/errors over a realistic Error/stack | `packages/panel-core/.../redaction.test.ts` |
| Judge model is **pinned** (never config-driven) | `panel-orchestrator.test.ts` / committee tests |
| `turn_detection: null` at mint (push-to-talk) | `mint-route.test.ts` + the shared `REALTIME_INPUT_CONFIG` |
| `MockTurn` is single-writer, `seq`-ordered | `turn-queue.test.ts`, `turns-route.test.ts` |
| BYOK key **never echoed**; decrypt only in the call frame | `keys-route.test.ts`, `crypto.test.ts` |
| `resolveSessionKey` is **fail-closed** → HOUSE on non-ACTIVE / unset KEK | `byok.test.ts` |
| Spend is atomic; money math exact to the cent (no float) | `spend.test.ts`, `spend-reserve.test.ts` |
| Idempotent session create (repeat `clientRequestId` never double-mints) | the create-route test *(gap — see §9)* |
| Daily-cap kill-switch trips and is observable | `spend.test.ts` |

---

## 7. Coverage policy

Coverage is a **ratchet, not a vanity number**: thresholds sit a few points below
current so a *regression* fails CI while today stays green. Raise them as gaps
close.

- **Scope (what's measured):** `vitest.config.ts → coverage.include` — the
  pure-logic packages, `src/lib`, and the active `interview`/`keys`/`resume` routes.
- **Excluded (and why):** generated Prisma client; `*.d.ts` and barrels;
  **pure I/O adapters / transport** (`providers/openai.ts`, `realtime-connection.ts`)
  exercised through mocked callers; **infra/framework glue** (`env`, `db`,
  `auth`, `log`); presentational constants (`brand`/`signal`/`motion`/`utils`).
- **Thresholds:** global ~76% lines / 66% branches; the pure-logic core
  (`packages/panel-core`) held to **92% lines / 84% branches**. Exact numbers in
  `vitest.config.ts`.
- A new module under an included path with no test scores **0** and drops the
  number — that's the point: untracked code surfaces as a coverage drop.

---

## 8. Deliberately NOT unit-tested

- **Presentational React components** (`*.tsx`: `interview-view`,
  `resume-upload`, `key-management`, `key-status-badge`, …). The runner env is
  `node` (no jsdom) and the include glob is `*.test.ts` — **by design**. These
  carry no branching logic worth a DOM harness; they're covered by `tsc`, the
  clean build, and the L5 live-test.
- **The rule that keeps this honest:** if a component grows real logic (a
  reducer, a derivation, a guard), **extract it to a pure hook/util and unit-test
  that** at L1 — don't reach for a component test. The FSM lives in
  `panel-machine.ts` (pure, tested), not in the view, for exactly this reason.
- **Pure I/O adapters / WebRTC transport** (`openai.ts`, `realtime-connection.ts`)
  — thin wrappers over `fetch`/`RTCPeerConnection`; their *callers* are tested
  with the adapter mocked. The pure event-mapping half (`realtime-events.ts`)
  *is* L1-tested.

---

## 9. Known gaps (tracked, not hidden)

- **`POST /api/interview/sessions` (the create route) has no handler test.** It owns
  the BYOK spend-split, `keySource` recording, resume injection, idempotency,
  rate-limit, daily-cap, and `markKeyFromMintError`. Highest-value next test;
  closing it lets the §7 threshold ratchet up.
- **No automated L5.** The founder live-test is the manual
  gate; it is the real exit, not a CI job. (Other tracked gaps: `docs/architecture.md` §9.)

---

## 10. Adding a test — the recipe

1. **Find the lowest layer.** New pure logic → L1 next to the source. New route
   behavior → an L2 `-route` test.
2. **L1:** import the real function, assert input→output. No mocks.
3. **L2:** `vi.hoisted` the boundary mocks (§4), keep panel-core real, drive the
   handler, assert the status + the security invariant it touches (§6).
4. **Determinism (§5),** one behavior per `it`, table-drive with `it.each`.
5. `npm run test:coverage` green locally before pushing — the same gate CI runs.
