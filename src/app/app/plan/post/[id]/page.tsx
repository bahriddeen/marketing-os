import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PostForm from "./PostForm";
import type { PlanPostRow } from "@/lib/types";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_posts")
    .select("*, content_plans(title), brands(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const post = data as unknown as PlanPostRow & {
    content_plans: { title: string } | null;
    brands: { name: string } | null;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          className="text-sm font-medium text-accent hover:underline"
          href="/app/plan"
        >
          ← Barcha postlar
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
          {post.date} — post
        </h1>
        <p className="mt-1 text-sm text-muted">
          {post.brands?.name ?? "—"} ·{" "}
          <Link
            href={`/app/plan/${post.plan_id}`}
            className="text-accent hover:underline"
          >
            {post.content_plans?.title ?? "Plan"}
          </Link>
        </p>
      </div>
      <PostForm post={post} />
    </div>
  );
}
