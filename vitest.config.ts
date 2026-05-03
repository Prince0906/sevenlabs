import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
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
    },
  },
});
