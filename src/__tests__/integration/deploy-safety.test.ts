import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
// Narrow source contract for this workflow; not a general YAML validator.
function job(name: string) {
  const block = workflow.split(/\n(?= {2}[a-z][a-z-]*:\n)/)
    .find((value) => value.startsWith(`  ${name}:\n`));
  expect(block, `missing deploy job ${name}`).toBeDefined();
  return block!;
}

describe("authentication cutover deployment safety", () => {
  it("blocks the staged auth backfill before any build or deployment", () => {
    const gate = job("gate");
    expect(gate).toMatch(/steps:\s*#(?:[^\n]*\n\s*#)*[^\n]*\n\s*- name: Block unfinished authentication cutover/);
    expect(gate).toContain("exit 1");
    expect(gate.indexOf("exit 1")).toBeLessThan(gate.indexOf("actions/checkout"));
    expect(job("build")).toContain("needs: gate");
    expect(job("migrate")).toContain("needs: build");
    expect(job("deploy")).toContain("needs: [build, migrate]");
  });

  it.each(["migrate", "deploy"])("puts %s behind the protected production environment", (name) => {
    expect(job(name)).toMatch(/^    environment: production$/m);
  });
});
