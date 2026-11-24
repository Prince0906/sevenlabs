import Link from "next/link";
import { Logo } from "@/components/logo";
import type { BlogPost } from "../lib/posts";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Chrome around a post. `html` is our own pre-rendered, trusted content. */
export function PostView({ post, html }: { post: BlogPost; html: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Aloud home">
            <Logo />
          </Link>
          <Link
            href="/blog"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            All posts
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Engineering · {formatDate(post.date)}
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <article
          className="blog-post mt-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  );
}
