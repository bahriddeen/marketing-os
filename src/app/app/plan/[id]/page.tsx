import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PlanTable from "./PlanTable";
import type { ContentPlan } from "@/lib/types";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_plans")
    .select("*, brands(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const plan = data as unknown as ContentPlan & { brands: { name: string } | null };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {plan.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {plan.brands?.name ?? "—"} · {plan.period_start.slice(0, 7)} ·{" "}
            {plan.post_count} ta post
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/plans/${plan.id}/export?format=xlsx`}>
            <Button variant="ghost">Excel (.xlsx)</Button>
          </a>
          <a href={`/api/plans/${plan.id}/export?format=csv`}>
            <Button variant="ghost">CSV</Button>
          </a>
        </div>
      </div>
      <PlanTable planId={plan.id} initialPosts={plan.posts} />
      <Link
        className="inline-block text-sm font-medium text-accent hover:underline"
        href="/app/plan"
      >
        ← Barcha planlar
      </Link>
    </div>
  );
}
