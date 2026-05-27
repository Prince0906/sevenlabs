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
      reporter: ["text", "lcov"],
      reportsDirectory: "./test-reports/coverage",
    },
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sevenlabs/coach-core": path.resolve(
        __dirname,
        "./packages/coach-core/src/index.ts"
      ),
      "@sevenlabs/shared-types": path.resolve(
        __dirname,
        "./packages/shared-types/src/index.ts"
      ),
    },
  },
});
