import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().default("http://localhost:3000"),

    // AWS S3 (audio storage — also used by Terraform for DevOps)
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_SESSION_TOKEN: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    S3_BUCKET_NAME: z.string().min(1),

    // OpenAI (Speaking Coach — Whisper, GPT, TTS)
    OPENAI_API_KEY: z.string().min(1),

    // Auth.js (NextAuth v5)
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});