import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POSTS, getPost, getPostMeta } from "@/features/blog/lib/posts";
import { PostView } from "@/features/blog/views/post-view";
import "../blog.css";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostMeta(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const found = getPost(slug);
  if (!found) notFound();
  return <PostView post={found.post} html={found.html} />;
}
