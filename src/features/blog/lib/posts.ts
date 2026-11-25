import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Blog posts live as pre-rendered HTML in src/content/blog/<slug>.html (our own
 * trusted content, generated from Markdown, never user input). Images are in
 * public/blog/<slug>/. To add a post: add the HTML and images, then one entry
 * here.
 */
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
}

export const POSTS: readonly BlogPost[] = [
  {
    slug: "voice-latency",
    title: "We put a stopwatch on our voice AI interviewer. Here is what it said.",
    description:
      "How one turn of a voice interview works, what we built around it, and what we measured when we timed the wait between pressing Done and hearing the reply.",
    date: "2026-11-24",
  },
];

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "blog");

export function getPostMeta(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null;
}

/**
 * Returns the post and its HTML, or null for an unknown slug. The slug is
 * matched against the registry first, so no request-supplied string ever
 * reaches the file system.
 */
export function getPost(slug: string): { post: BlogPost; html: string } | null {
  const post = getPostMeta(slug);
  if (!post) return null;
  const html = readFileSync(path.join(CONTENT_DIR, `${post.slug}.html`), "utf8");
  return { post, html };
}
