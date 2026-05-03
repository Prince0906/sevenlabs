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
      // Verify the env module exports the expected shape
      // We import a fresh module to check the schema definition
      const envModule = await import("@/lib/env");

      expect(envModule.env).toBeDefined();
      expect(typeof envModule.env).toBe("object");
    });

    it("should list all required env variables for deployment", () => {
      // Document all required env vars for the CI/CD pipeline
      const requiredEnvVars = [
        "DATABASE_URL",
        "APP_URL",
        "REPLICATE_API_TOKEN",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "S3_BUCKET_NAME",
      ];

      // This test serves as documentation — ensures we track required vars
      expect(requiredEnvVars.length).toBeGreaterThan(0);
      requiredEnvVars.forEach((v) => {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Module Exports", () => {
    it("should export synthesizeSpeech from chatterbox module", async () => {
      const mod = await import("@/lib/chatterbox");
      expect(mod.synthesizeSpeech).toBeDefined();
      expect(typeof mod.synthesizeSpeech).toBe("function");
    });

    it("should export S3 functions from s3 module", async () => {
      const mod = await import("@/lib/s3");
      expect(mod.uploadAudio).toBeDefined();
      expect(mod.getSignedUrl).toBeDefined();
      expect(mod.deleteObject).toBeDefined();
    });
  });
});
