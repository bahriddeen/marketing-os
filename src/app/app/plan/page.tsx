import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type PlanListRow = {
  id: string;
  title: string;
  period_start: string;
  post_count: number;
  created_at: string;
  brands: { name: string } | null;
};

export default async function PlansPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_plans")
    .select("id, title, period_start, post_count, created_at, brands(name)")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const plans = (data ?? []) as unknown as PlanListRow[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Kontent-plan
        </h1>
        <Link href="/app/plan/new">
          <Button>Yangi plan</Button>
        </Link>
      </div>
      {plans.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">
            Hali kontent-planingiz yo‘q. Brend tanlang — sun‘iy intellekt bir
            oylik plan tuzib beradi.
          </p>
          <Link href="/app/plan/new" className="mt-4 inline-block">
            <Button>Birinchi planni yaratish</Button>
          </Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <h2 className="font-semibold text-ink">{p.title}</h2>
            <p className="text-sm text-muted">
              {p.brands?.name ?? "—"} · {p.period_start.slice(0, 7)} ·{" "}
              {p.post_count} ta post
            </p>
            <Link
              className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
              href={`/app/plan/${p.id}`}
            >
              Ochish
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
