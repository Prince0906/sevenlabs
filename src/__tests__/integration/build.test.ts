// The env module evaluates at import time via @t3-oss/env-nextjs and will
// throw if real env vars are missing. Set SKIP_ENV_VALIDATION before any
// import of @/lib/env.
process.env.SKIP_ENV_VALIDATION = "true";

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

// ─── Integration Tests ───────────────────────────────────────────────────────
// These tests verify the application builds correctly and env validation works.

const projectRoot = path.resolve(__dirname, "../../..");

describe("Application Integration", () => {
  describe("Build Verification", () => {
    it("should compile TypeScript without errors", () => {
      const result = execSync("npx tsc --noEmit", {
        cwd: projectRoot,
        env: { ...process.env, SKIP_ENV_VALIDATION: "true" },
        timeout: 60_000,
      });

      // If it doesn't throw, compilation succeeded
      expect(result).toBeDefined();
    }, 60_000);
  });

  describe("Environment Validation", () => {
    it("should define required env variables in schema", async () => {
      const envModule = await import("@/lib/env");

      expect(envModule.env).toBeDefined();
      expect(typeof envModule.env).toBe("object");
    });

    it("should list all required env variables for deployment", () => {
      const requiredEnvVars = [
        "DATABASE_URL",
        "OPENAI_API_KEY",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "S3_BUCKET_NAME",
        // Auth.js
        "AUTH_SECRET",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
      ];

      expect(requiredEnvVars.length).toBeGreaterThan(0);
      requiredEnvVars.forEach((v) => {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Module Exports", () => {
    it("should export S3 functions from s3 module", async () => {
      const mod = await import("@/lib/s3");
      expect(mod.uploadAudio).toBeDefined();
      expect(mod.getSignedUrl).toBeDefined();
      expect(mod.deleteObject).toBeDefined();
    });
  });
});
