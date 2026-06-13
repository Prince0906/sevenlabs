import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().min(1),

    // AWS S3 — OPTIONAL. Only the PARKED Speaking Coach stores audio in S3; the
    // interview panel derives its metrics in-memory and never writes to S3. Leave
    // unset to run the panel with no AWS account at all (s3.ts throws a clear
    // error only if a coach path actually tries to use S3 while unconfigured).
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_SESSION_TOKEN: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    S3_BUCKET_NAME: z.string().optional(),

    // OpenAI (Speaking Coach — Whisper, GPT, TTS)
    OPENAI_API_KEY: z.string().min(1),

    // BYOK key-encryption secret (the env KEK). Optional so the app boots without
    // it; when unset, BYOK key storage is disabled (the /api/keys route returns
    // 503) and everything runs on the house key. Must be >= 32 chars of high
    // entropy. Rotating it invalidates all stored ProviderKeys (users re-paste).
    KEY_ENCRYPTION_SECRET: z.string().min(32).optional(),

    // Disfluency measurement (verbatim ASR). Optional: when set, per-answer
    // audio is transcribed VERBATIM by Deepgram (filler_words:true) so fillers/
    // repeats/false-starts are measurable; when unset, the pipeline falls back to
    // Whisper (which cleans speech, so disfluency reads artificially low).
    DEEPGRAM_API_KEY: z.string().optional(),

    // Confidence engine — real-time voice. Config-driven:
    // realtime model/endpoints can change; judgment model stays pinned in code.
    // Defaults keep the env valid before these are set in prod.
    OPENAI_REALTIME_MODEL: z.string().default("gpt-realtime"),
    OPENAI_REALTIME_MINT_URL: z
      .string()
      .url()
      .default("https://api.openai.com/v1/realtime/client_secrets"),
    // GA SDP-exchange endpoint. The deprecated Beta /v1/realtime?model= shape
    // is dead; the client POSTs its SDP offer here with the ephemeral as Bearer
    // and NO ?model= (the model is bound to the ephemeral at mint).
    OPENAI_REALTIME_URL: z
      .string()
      .url()
      .default("https://api.openai.com/v1/realtime/calls"),
    REALTIME_USD_PER_MIN: z.coerce.number().default(0.3),
    // SESSION_CEILING_USD is the per-session HOUSE-KEY spend cap and the real
    // bound on length: at $0.30/min a $4 cap is ~13 min, so house/trial sessions
    // stay short and cheap. A full ~1-hour interview (~$18 on the house key) is
    // gated on BYOK (the user's key pays) — or raise this locally for a founder
    // live-test. MAX_SESSION_SEC is the time backstop, set to a full hour so it's
    // never the binding constraint once the ceiling is raised. (§14.2)
    SESSION_CEILING_USD: z.coerce.number().default(4),
    MAX_SESSION_SEC: z.coerce.number().int().default(3600),
    DAILY_CAP_USD: z.coerce.number().default(50),

    // Auth.js (NextAuth v5)
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});