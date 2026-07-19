import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PlansToolbar from "./PlansToolbar";
import PlansTable, { type PlanRow } from "./PlansTable";
import { parsePlansParams, buildPlansQuery } from "@/lib/plansTable";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = parsePlansParams(sp);
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", ws.id)
    .order("name");
  const brands = brandsData ?? [];

  let query = supabase
    .from("content_plans")
    .select("id, title, period_start, post_count, brands(name)", { count: "exact" })
    .eq("workspace_id", ws.id);

  if (p.q) {
    const q = p.q.replace(/[,()]/g, " ").trim();
    if (q) query = query.ilike("title", `%${q}%`);
  }
  if (p.brand) query = query.eq("brand_id", p.brand);
  if (p.platform) query = query.eq("platform", p.platform);

  const from = (p.page - 1) * p.size;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + p.size - 1);
  const plans = (data ?? []) as unknown as PlanRow[];
  const total = count ?? 0;
  const hasFilters = !!p.q || !!p.brand || !!p.platform;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Kontent-plan
        </h1>
        <Link href="/app/plan/new">
          <Button>Yangi plan</Button>
        </Link>
      </div>

      {total === 0 && !hasFilters ? (
        <Card className="text-center">
          <p className="text-muted">
            Hali kontent-planingiz yo‘q. Brend tanlang — sun‘iy intellekt bir
            oylik plan tuzib beradi.
          </p>
          <Link href="/app/plan/new" className="mt-4 inline-block">
            <Button>Birinchi planni yaratish</Button>
          </Link>
        </Card>
      ) : (
        <>
          <PlansToolbar brands={brands} params={p} />
          {plans.length === 0 ? (
            <Card className="text-center">
              <p className="text-muted">Hech narsa topilmadi.</p>
              <Link href="/app/plan" className="mt-4 inline-block">
                <Button variant="ghost">Filtrlarni tozalash</Button>
              </Link>
            </Card>
          ) : (
            <PlansTable key={buildPlansQuery(p) || "default"} plans={plans} params={p} total={total} />
          )}
        </>
      )}
    </div>
  );
}
