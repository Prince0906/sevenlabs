import { build } from "esbuild";

// Bundle workspace source; runtime vendor dependencies remain installed packages.
// This tests a real Node artifact, rather than relying on Next's TS resolver.
await build({
  entryPoints: {
    "api/main": "apps/api/src/main.ts",
    "worker/main": "apps/worker/src/main.ts",
  },
  outdir: "build",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external: ["fastify", "better-auth", "@better-auth/*", "bcryptjs", "@prisma/*", "@t3-oss/*", "pg", "unpdf", "zod"],
  logLevel: "info",
});
