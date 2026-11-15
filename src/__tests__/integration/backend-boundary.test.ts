import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import legacyImports from "./legacy-backend-imports.json";

const root = path.resolve(__dirname, "../../..");
const backend = "packages/backend/src/";
const exportsMap = JSON.parse(readFileSync(path.join(root, "packages/backend/package.json"), "utf8")).exports as Record<string, string>;
const legacy = legacyImports as Record<string, string[]>;
const dependencies: Record<string, string[]> = {
  identity: [], profiles: [], usage: [], interviews: ["identity", "profiles", "usage"],
};
// Infrastructure exports are restricted composition/migration seams, not APIs
// available to arbitrary route files. Remove legacy entries as routes migrate.
const runtimeImports: Record<string, string[]> = {
  "apps/api/src/identity.ts": ["infrastructure/email"],
  "apps/api/src/email-webhook.ts": ["infrastructure/email"],
  "apps/api/src/main.ts": ["infrastructure/db", "infrastructure/log"],
  "apps/api/src/server.ts": ["infrastructure/db", "infrastructure/log", "infrastructure/crypto"],
  "apps/worker/src/main.ts": ["infrastructure/db", "infrastructure/log", "interviews/jobs", "usage/spend"],
};
const databaseCallers = new Set([
  "infrastructure/db.ts",
  "infrastructure/email/service.ts",
  "modules/identity/byok.ts",
  "modules/identity/auth.ts",
  "modules/identity/disable-account.ts",
  "modules/profiles/resume-digest.ts",
  "modules/usage/spend.ts",
  "modules/interviews/evaluation/panel-orchestrator.ts",
  "modules/interviews/evaluation/judgment-queue.ts",
]);

function violation(file: string, specifier: string): string | null {
  const isBackend = file.startsWith(backend);
  const isRuntime = file.startsWith("apps/");
  const isWeb = file.startsWith("src/");
  if ((isBackend || isRuntime) && /^(next(?:\/|$)|next-auth(?:\/|$)|react(?:\/|$)|@\/)/.test(specifier)) return "web dependency";
  if (isWeb && /^(?:@prisma\/|pg$)/.test(specifier)) return "web database dependency";
  if ((isBackend || isRuntime) && /^(?:@prisma\/|pg$)/.test(specifier)
    && file !== backend + "infrastructure/db.ts") return "database driver outside infrastructure owner";

  const publicImport = specifier.startsWith("@sevenlabs/backend/");
  let target: string | undefined;
  if (publicImport) {
    const key = "./" + specifier.slice("@sevenlabs/backend/".length);
    if (!exportsMap[key]) return "unexported backend implementation";
    target = path.posix.normalize("packages/backend/" + exportsMap[key]);
  } else if (specifier.startsWith(".")) {
    target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  } else if (specifier === "@sevenlabs/api" || specifier === "@sevenlabs/worker") {
    return "runtime dependency";
  }
  if (!target) return null;
  if ((isBackend || isRuntime) && target.startsWith("src/")) return "web dependency";
  if (isBackend && target.startsWith("apps/")) return "runtime dependency";
  if (isRuntime && target.startsWith("apps/") && target.split("/")[1] !== file.split("/")[1]) return "cross-runtime dependency";
  if (!target.startsWith(backend)) return null;
  if (isWeb) return publicImport && legacy[file]?.includes(specifier) ? null : "new transitional backend access";
  if (isRuntime) {
    if (!publicImport) return "runtime bypasses package exports";
    const entry = specifier.slice("@sevenlabs/backend/".length);
    if (entry.startsWith("infrastructure/") || file.startsWith("apps/worker/")) {
      return runtimeImports[file]?.includes(entry) ? null : "unsupported runtime access";
    }
    return null;
  }
  if (!isBackend) return null;
  const local = file.slice(backend.length);
  const destination = target.slice(backend.length).replace(/\.ts$/, "");
  if ((destination === "infrastructure/db" || destination.startsWith("generated/")) && !databaseCallers.has(local)) return "unregistered database owner";
  if (local.startsWith("infrastructure/") && destination.startsWith("modules/")) return "infrastructure depends on business module";
  const from = local.match(/^modules\/([^/]+)\//)?.[1];
  const to = destination.match(/^modules\/([^/]+)\//)?.[1];
  if (from && to && from !== to) {
    if (!dependencies[from]?.includes(to)) return "forbidden module dependency";
    if (!publicImport) return "cross-module internal import";
  }
  return null;
}
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "generated" || entry.name === "__tests__") return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) ? [file] : [];
  });
}
function imports(file: string): string[] {
  return importSpecifiers(readFileSync(file, "utf8"), file);
}
function importSpecifiers(text: string, file = "fixture.ts"): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const values: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) values.push(node.moduleSpecifier.text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteral(node.argument.literal)) values.push(node.argument.literal.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      values.push(node.moduleReference.expression.text);
    }
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) {
      values.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return values;
}

describe("backend dependency boundary", () => {
  it.each([
    'import { prisma } from "@sevenlabs/backend/infrastructure/db";',
    'import type { Prisma } from "@sevenlabs/backend/infrastructure/db";',
    'export { prisma } from "@sevenlabs/backend/infrastructure/db";',
    'type Db = typeof import("@sevenlabs/backend/infrastructure/db");',
    'type Db = import("@sevenlabs/backend/infrastructure/db").Prisma;',
    'import db = require("@sevenlabs/backend/infrastructure/db");',
    'const db = require("@sevenlabs/backend/infrastructure/db");',
    'const db = import("@sevenlabs/backend/infrastructure/db");',
  ])("checks the dependency behind %s", (text) => {
    const specifiers = importSpecifiers(text);
    expect(specifiers).toEqual(["@sevenlabs/backend/infrastructure/db"]);
    expect(violation("src/app/new/page.tsx", specifiers[0])).toBe("new transitional backend access");
  });

  it("enforces supported entries and dependency direction across real source files", () => {
    const files = ["src", "packages/backend/src", "apps/api/src", "apps/worker/src"].flatMap((dir) => sourceFiles(path.join(root, dir)));
    expect(files.flatMap((file) => imports(file).flatMap((specifier) => {
      const relative = path.relative(root, file);
      const reason = violation(relative, specifier);
      return reason ? [`${relative}: ${specifier}: ${reason}`] : [];
    }))).toEqual([]);
  });

  it.each([
    ["modules/usage/spend.ts", "@sevenlabs/backend/interviews/jobs", "forbidden module dependency"],
    ["modules/identity/byok.ts", "../profiles/resume", "forbidden module dependency"],
    ["modules/interviews/commands.ts", "../usage/spend", "cross-module internal import"],
    ["infrastructure/log.ts", "../modules/identity/byok", "infrastructure depends on business module"],
    ["modules/profiles/new.ts", "../../infrastructure/db", "unregistered database owner"],
    ["modules/identity/byok.ts", "next/headers", "web dependency"],
    ["modules/identity/byok.ts", "@sevenlabs/backend/modules/usage/spend", "unexported backend implementation"],
  ])("rejects %s importing %s", (file, specifier, reason) => {
    expect(violation(backend + file, specifier)).toBe(reason);
  });

  it.each([
    ["src/app/new/page.tsx", "@sevenlabs/backend/infrastructure/db", "new transitional backend access"],
    ["src/app/new/page.tsx", "../../../packages/backend/src/infrastructure/db", "new transitional backend access"],
    ["src/app/new/page.tsx", "@prisma/client", "web database dependency"],
    ["apps/api/src/routes/new.ts", "@sevenlabs/backend/infrastructure/db", "unsupported runtime access"],
    ["apps/worker/src/main.ts", "../../api/src/server", "cross-runtime dependency"],
    ["apps/worker/src/main.ts", "../../../packages/backend/src/infrastructure/db", "runtime bypasses package exports"],
    ["apps/api/src/server.ts", "@sevenlabs/backend/generated/prisma/client", "unexported backend implementation"],
  ])("rejects bypass from %s to %s", (file, specifier, reason) => {
    expect(violation(file, specifier)).toBe(reason);
  });

  it("permits supported cross-module and runtime use cases", () => {
    expect(violation(backend + "modules/interviews/commands.ts", "@sevenlabs/backend/usage/spend")).toBeNull();
    expect(violation("apps/worker/src/main.ts", "@sevenlabs/backend/interviews/jobs")).toBeNull();
  });

  it("has no wildcard/generated export or resolver alias that bypasses exports", () => {
    expect(Object.keys(exportsMap).filter((key) => key.includes("*") || key.includes("generated"))).toEqual([]);
    const tsconfig = JSON.parse(readFileSync(path.join(root, "tsconfig.json"), "utf8"));
    expect(Object.keys(tsconfig.compilerOptions.paths).filter((key) => key.startsWith("@sevenlabs/backend"))).toEqual([]);
    expect(readFileSync(path.join(root, "vitest.config.ts"), "utf8")).not.toMatch(/"@sevenlabs\/backend"\s*:/);
  });

  it("keeps backend and runtime foundations independent of Next and web source", () => {
    const files = ["packages/backend/src", "apps/api/src", "apps/worker/src"].flatMap((dir) => sourceFiles(path.join(root, dir)));
    const violations = files.flatMap((file) => imports(file)
      .filter((name) => /^(next(?:\/|$)|next-auth(?:\/|$)|react(?:\/|$)|@\/)/.test(name)
        || (name.startsWith(".") && path.resolve(path.dirname(file), name).startsWith(path.join(root, "src") + path.sep)))
      .map((name) => `${path.relative(root, file)}: ${name}`));
    expect(violations).toEqual([]);
  });

  it("does not let the worker import the API runtime to reuse business logic", () => {
    const files = sourceFiles(path.join(root, "apps/worker/src"));
    expect(files.flatMap(imports).filter((name) => name.includes("apps/api") || name.startsWith("@sevenlabs/api"))).toEqual([]);
  });

  it("has one generated Prisma owner", () => {
    expect(readFileSync(path.join(root, "prisma/schema.prisma"), "utf8"))
      .toContain('output   = "../packages/backend/src/generated/prisma"');
    expect(readFileSync(path.join(root, "Dockerfile"), "utf8"))
      .toContain("/app/packages/backend/src/generated/prisma ./packages/backend/src/generated/prisma");
  });
});
