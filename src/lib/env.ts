import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().default("http://localhost:3000"),

    // Replicate (TTS via cloud-hosted Chatterbox)
    REPLICATE_API_TOKEN: z.string().min(1),

    // AWS S3 (audio storage — also used by Terraform for DevOps)
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_SESSION_TOKEN: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    S3_BUCKET_NAME: z.string().min(1),

    // Polar Billing (deferred — optional for now)
    POLAR_ACCESS_TOKEN: z.string().optional(),
    POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_PRODUCT_ID: z.string().optional(),
    POLAR_METER_VOICE_CREATION: z.string().optional(),
    POLAR_METER_TTS_GENERATION: z.string().optional(),
    POLAR_METER_TTS_PROPERTY: z.string().optional(),
  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});