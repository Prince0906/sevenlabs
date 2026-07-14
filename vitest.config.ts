import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "packages/**/*.test.ts"],
    environment: "node",
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./test-reports/junit.xml",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./test-reports/coverage",
      // Gate the layers we hold to the testing standard (TESTING.md). `include`
      // counts EVERY matching file, so an untested-but-included module scores 0 —
      // intentional: a new untracked file shows up as a coverage drop.
      include: [
        "packages/panel-core/src/**/*.ts",
        "src/lib/**/*.ts",
        "src/app/api/mock/**/*.ts",
        "src/app/api/keys/**/*.ts",
        "src/app/api/resume/**/*.ts",
        "src/features/mock-panel/lib/**/*.ts",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/index.ts", // barrels — no logic
        "**/*.d.ts",
        // Pure I/O adapters / transport — exercised through mocked callers, not
        // unit-tested directly (TESTING.md §"Deliberately not unit-tested").
        "src/lib/providers/openai.ts",
        "src/features/mock-panel/lib/realtime-connection.ts",
        // Infra / framework glue / config — no unit-testable behavior. log.ts is a
        // thin stdout chokepoint; its redaction LOGIC is tested in panel-core and
        // is a named entry in the invariant contract (TESTING.md).
        "src/lib/env.ts",
        "src/lib/db.ts",
        "src/lib/auth.ts",
        "src/lib/log.ts",
        "src/lib/brand.ts",
        "src/lib/signal.ts",
        "src/lib/motion.ts",
        "src/lib/utils.ts",
      ],
      // Ratchet: set a few points BELOW current so a regression fails CI but
      // today is green. Raise these as gaps close (e.g. the create-route test).
      // The pure-logic core (panel-core) is held to a markedly higher bar.
      thresholds: {
        statements: 75,
        branches: 66,
        functions: 77,
        lines: 76,
        "packages/panel-core/src/**/*.ts": {
          statements: 91,
          branches: 84,
          functions: 92,
          lines: 92,
        },
      },
    },
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sevenlabs/panel-core": path.resolve(
        __dirname,
        "./packages/panel-core/src/index.ts"
      ),
      "@sevenlabs/shared-types": path.resolve(
        __dirname,
        "./packages/shared-types/src/index.ts"
      ),
    },
  },
});
