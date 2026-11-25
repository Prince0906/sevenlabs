import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { POSTS, getPost, getPostMeta } from "@/features/blog/lib/posts";

describe("blog posts registry", () => {
  it("has unique slugs and ISO dates", () => {
    const slugs = POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of POSTS) expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns metadata for a known slug and null for an unknown one", () => {
    expect(getPostMeta("voice-latency")?.slug).toBe("voice-latency");
    expect(getPostMeta("nope")).toBeNull();
  });

  it("loads the HTML for a known slug", () => {
    const found = getPost("voice-latency");
    expect(found).not.toBeNull();
    expect(found!.html.length).toBeGreaterThan(1000);
    expect(found!.html).toContain("<h2");
  });

  it("never reads the file system for an unregistered slug (path traversal)", () => {
    expect(getPost("../../package")).toBeNull();
    expect(getPost("..%2F..%2Fpackage")).toBeNull();
  });

  it("every image the post references exists under public/", () => {
    const found = getPost("voice-latency")!;
    const srcs = [...found.html.matchAll(/src="(\/blog\/[^"]+)"/g)].map((m) => m[1]!);
    expect(srcs.length).toBeGreaterThanOrEqual(10);
    for (const src of srcs) {
      expect(existsSync(path.join(process.cwd(), "public", src))).toBe(true);
    }
  });

  it("contains no em dashes and no script tags", () => {
    const html = getPost("voice-latency")!.html;
    expect(html).not.toContain("—");
    expect(html.toLowerCase()).not.toContain("<script");
  });
});
