import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PostsToolbar from "./PostsToolbar";
import PostsTable, { type DashboardPost } from "./PostsTable";
import { parseTableParams, buildTableQuery, PAGE_SIZE } from "@/lib/planTable";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = parseTableParams(sp);
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", ws.id)
    .order("name");
  const brands = brandsData ?? [];

  let query = supabase
    .from("plan_posts")
    .select(
      "id, date, topic, hook, format, status, plan_id, content_plans!inner(title, platform), brands(name)",
      { count: "exact" }
    )
    .eq("workspace_id", ws.id);

  if (p.q) {
    const q = p.q.replace(/[,()]/g, " ").trim();
    if (q) query = query.or(`topic.ilike.%${q}%,hook.ilike.%${q}%`);
  }
  if (p.brand) query = query.eq("brand_id", p.brand);
  if (p.status) query = query.eq("status", p.status);
  if (p.format) query = query.eq("format", p.format);
  if (p.platform) query = query.eq("content_plans.platform", p.platform);

  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count } = await query
    .order(p.sort, { ascending: p.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  const posts = (data ?? []) as unknown as DashboardPost[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    !!p.q || !!p.brand || !!p.status || !!p.format || !!p.platform;

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
          <PostsToolbar brands={brands} params={p} />
          {posts.length === 0 ? (
            <Card className="text-center">
              <p className="text-muted">Hech narsa topilmadi.</p>
              <Link href="/app/plan" className="mt-4 inline-block">
                <Button variant="ghost">Filtrlarni tozalash</Button>
              </Link>
            </Card>
          ) : (
            <>
              <PostsTable
                key={buildTableQuery(p) || "default"}
                posts={posts}
                params={p}
              />
              <div className="flex items-center justify-between text-sm text-muted">
                <span className="font-mono tabular-nums">
                  {from + 1}–{Math.min(from + PAGE_SIZE, total)} / {total}
                </span>
                <div className="flex gap-2">
                  {p.page > 1 ? (
                    <Link href={`/app/plan${buildTableQuery(p, { page: p.page - 1 })}`}>
                      <Button variant="ghost">← Oldingi</Button>
                    </Link>
                  ) : (
                    <Button variant="ghost" disabled>
                      ← Oldingi
                    </Button>
                  )}
                  {p.page < lastPage ? (
                    <Link href={`/app/plan${buildTableQuery(p, { page: p.page + 1 })}`}>
                      <Button variant="ghost">Keyingi →</Button>
                    </Link>
                  ) : (
                    <Button variant="ghost" disabled>
                      Keyingi →
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
