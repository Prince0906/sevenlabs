import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { POSTS } from "@/features/blog/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Engineering notes from building Aloud.",
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Aloud home">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">Blog</h1>
        <ul className="mt-8 space-y-8">
          {POSTS.map((p) => (
            <li key={p.slug}>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {p.date}
              </p>
              <Link href={`/blog/${p.slug}`} className="mt-1 block">
                <h2 className="font-display text-xl font-bold hover:underline">{p.title}</h2>
              </Link>
              <p className="mt-2 text-muted-foreground">{p.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
