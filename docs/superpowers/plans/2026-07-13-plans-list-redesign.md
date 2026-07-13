# Plans List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the posts-first dashboard at `/app/plan` with a wireframe-matching plans table: title search + filter-icon panel, pencil/trash row actions (plan delete is new), and numbered pagination with a page-size selector.

**Architecture:** One server page querying `content_plans` (+ `brands(name)` join) with URL-driven params; client `PlansToolbar` (search + collapsible filter panel) and `PlansTable` (clickable rows, inline delete confirm, numbered pagination footer). Pure helpers (`parsePlansParams`, `buildPlansQuery`, `pageItems`) are TDD'd. `PostsToolbar`/`PostsTable`/`planTable.ts` are deleted; plan detail, post page, exports, statuses stay untouched.

**Tech Stack:** Next.js 16 App Router (Promise `searchParams`), Supabase RLS, Zod v4, Tailwind v4 semantic tokens, vitest, lucide-react icons.

**Design spec:** `docs/superpowers/specs/2026-07-13-plans-list-redesign-design.md`

## Global Constraints

- All UI copy Uzbek (Latin); apostrophe is **U+2018 (`‘`)** — never U+2019/ASCII. Gate: `grep -rn $'’' src/app/app/plan/ src/lib/plansTable.ts` → empty.
- Semantic color utilities only. Sanctioned precedents: `text-white` on `bg-accent` (matches `Button` primary variant), `w-auto!` to beat the `Select` primitive's base `w-full` (Tailwind v4 trailing-`!` important).
- React Compiler lint rules apply: NO `setState` inside `useEffect` bodies (cleanup-only effects are fine); the render-time conditional "prev state" sync pattern is the approved way to sync from props.
- UI primitives from `src/components/ui/` (`Button` variants: primary/secondary/ghost/danger; `Input`, `Select`, `Card`).
- No native browser dialogs (no `confirm()`/`alert()`).
- Gates per task: named vitest file, `npm test`, `npx tsc --noEmit`; plus `npm run lint` and `npm run build` where pages change. Commit after every task.

---

### Task 1: Pure plans-table helpers

**Files:**
- Create: `src/lib/plansTable.ts`
- Test: `src/lib/plansTable.test.ts`

**Interfaces:**
- Consumes: `PLAN_PLATFORMS`/`PlanPlatform` from `@/lib/ai/modules/contentPlan`.
- Produces: `PLAN_PAGE_SIZES = [10, 25, 50] as const`; `type PlansParams = { q: string; brand: string; platform: PlanPlatform | ""; page: number; size: number }`; `parsePlansParams(sp: Record<string, string | string[] | undefined>): PlansParams`; `buildPlansQuery(params: PlansParams, overrides?: Partial<PlansParams>): string`; `pageItems(current: number, last: number): (number | "…")[]`.

- [ ] **Step 1: Write the failing tests** — `src/lib/plansTable.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parsePlansParams,
  buildPlansQuery,
  pageItems,
  PLAN_PAGE_SIZES,
} from "./plansTable";

describe("parsePlansParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlansParams({})).toEqual({
      q: "",
      brand: "",
      platform: "",
      page: 1,
      size: 10,
    });
  });

  it("accepts valid values", () => {
    expect(
      parsePlansParams({ q: "avgust", brand: "b1", platform: "both", page: "3", size: "25" })
    ).toEqual({ q: "avgust", brand: "b1", platform: "both", page: 3, size: 25 });
  });

  it("falls back to defaults on hostile values, never throws", () => {
    const p = parsePlansParams({
      platform: "tiktok",
      page: "-4",
      size: "17",
      q: ["a", "b"] as unknown as string,
    });
    expect(p.platform).toBe("");
    expect(p.page).toBe(1);
    expect(p.size).toBe(10);
    expect(p.q).toBe("a");
  });

  it("exports the size whitelist", () => {
    expect(PLAN_PAGE_SIZES).toEqual([10, 25, 50]);
  });
});

describe("buildPlansQuery", () => {
  const defaults = parsePlansParams({});

  it("returns empty string for all-default params", () => {
    expect(buildPlansQuery(defaults)).toBe("");
  });

  it("serializes non-defaults, url-encodes q, applies overrides", () => {
    const p = { ...defaults, q: "yozgi plan", size: 25, page: 2 };
    expect(buildPlansQuery(p)).toBe("?q=yozgi%20plan&page=2&size=25");
    expect(buildPlansQuery(p, { page: 1 })).toBe("?q=yozgi%20plan&size=25");
  });
});

describe("pageItems", () => {
  it("lists all pages when few", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the middle with ellipsis", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, "…", 10]);
    expect(pageItems(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(pageItems(10, 10)).toEqual([1, "…", 9, 10]);
  });

  it("fills a gap of exactly one instead of an ellipsis", () => {
    expect(pageItems(3, 10)).toEqual([1, 2, 3, 4, "…", 10]);
    expect(pageItems(8, 10)).toEqual([1, "…", 7, 8, 9, 10]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/plansTable.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `src/lib/plansTable.ts`:

```ts
import { PLAN_PLATFORMS, type PlanPlatform } from "@/lib/ai/modules/contentPlan";

export const PLAN_PAGE_SIZES = [10, 25, 50] as const;

export type PlansParams = {
  q: string;
  brand: string;
  platform: PlanPlatform | "";
  page: number;
  size: number;
};

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export function parsePlansParams(
  sp: Record<string, string | string[] | undefined>
): PlansParams {
  const platform = first(sp.platform);
  const size = Number(first(sp.size));
  return {
    q: first(sp.q).slice(0, 200),
    brand: first(sp.brand),
    platform: (Object.keys(PLAN_PLATFORMS) as PlanPlatform[]).includes(
      platform as PlanPlatform
    )
      ? (platform as PlanPlatform)
      : "",
    page: Math.max(1, Math.floor(Number(first(sp.page))) || 1),
    size: (PLAN_PAGE_SIZES as readonly number[]).includes(size) ? size : 10,
  };
}

export function buildPlansQuery(
  params: PlansParams,
  overrides: Partial<PlansParams> = {}
): string {
  const p = { ...params, ...overrides };
  const parts: string[] = [];
  if (p.q) parts.push(`q=${encodeURIComponent(p.q)}`);
  if (p.brand) parts.push(`brand=${encodeURIComponent(p.brand)}`);
  if (p.platform) parts.push(`platform=${p.platform}`);
  if (p.page > 1) parts.push(`page=${p.page}`);
  if (p.size !== 10) parts.push(`size=${p.size}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function pageItems(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const wanted = [...new Set([1, current - 1, current, current + 1, last])]
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of wanted) {
    if (n - prev === 2) out.push(prev + 1);
    else if (n - prev > 2) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/plansTable.test.ts` — Expected: PASS. Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plansTable.ts src/lib/plansTable.test.ts
git commit -m "feat: add plans table param and pagination helpers"
```

---

### Task 2: `deletePlan` server action

**Files:**
- Modify: `src/app/app/plan/actions.ts` (append; existing `updatePlanPost`/`bulkUpdateStatus` stay — `bulkUpdateStatus` is intentionally kept though currently unused by UI, per spec §4)

**Interfaces:**
- Consumes: existing imports in the file (`z`, `createClient`, `revalidatePath`).
- Produces: `deletePlan(planId: string): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Append the action** to `src/app/app/plan/actions.ts`:

```ts
export async function deletePlan(
  planId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(planId).success) {
    return { ok: false, error: "Plan topilmadi." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_plans")
    .delete()
    .eq("id", planId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: "O‘chirib bo‘lmadi. Qayta urinib ko‘ring." };
  }
  if (!data) {
    return { ok: false, error: "Plan topilmadi." };
  }

  revalidatePath("/app/plan", "layout");
  return { ok: true };
}
```

`plan_posts` rows go via the DB `on delete cascade`; `generations` rows are untouched (their FK points from `content_plans.generation_id` to `generations`, not the reverse).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; `npm test` PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/plan/actions.ts
git commit -m "feat: add deletePlan server action"
```

---

### Task 3: Plans page — toolbar, table, pagination; delete posts-dashboard files

**Files:**
- Rewrite: `src/app/app/plan/page.tsx`
- Create: `src/app/app/plan/PlansToolbar.tsx`
- Create: `src/app/app/plan/PlansTable.tsx`
- Delete: `src/app/app/plan/PostsToolbar.tsx`, `src/app/app/plan/PostsTable.tsx`, `src/lib/planTable.ts`, `src/lib/planTable.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 `deletePlan`, `PLAN_PLATFORMS`, UI primitives.
- Produces: `PlanRow` type (exported from `PlansTable.tsx`): `{ id: string; title: string; period_start: string; post_count: number; brands: { name: string } | null }`.

- [ ] **Step 1: Rewrite `src/app/app/plan/page.tsx`**:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PlansToolbar from "./PlansToolbar";
import PlansTable, { type PlanRow } from "./PlansTable";
import { parsePlansParams } from "@/lib/plansTable";

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
            <PlansTable plans={plans} params={p} total={total} />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/app/plan/PlansToolbar.tsx`**:

```tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { buildPlansQuery, type PlansParams } from "@/lib/plansTable";
import { PLAN_PLATFORMS } from "@/lib/ai/modules/contentPlan";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BrandOption = { id: string; name: string };

export default function PlansToolbar({
  brands,
  params,
}: {
  brands: BrandOption[];
  params: PlansParams;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [prevQ, setPrevQ] = useState(params.q);
  if (params.q !== prevQ) {
    setPrevQ(params.q);
    if (params.q === "") setQ("");
  }
  const [open, setOpen] = useState(!!(params.brand || params.platform));
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  function apply(overrides: Partial<PlansParams>) {
    startTransition(() => {
      router.replace(`/app/plan${buildPlansQuery(params, { ...overrides, page: 1 })}`);
    });
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value }), 300);
  }

  const activeCount = (params.brand ? 1 : 0) + (params.platform ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Plan nomi bo‘yicha qidirish…"
            className="pl-9"
            aria-label="Qidirish"
          />
        </div>
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setOpen((o) => !o)}
            aria-label="Filtrlar"
            aria-expanded={open}
            className="px-3"
          >
            <SlidersHorizontal size={16} />
          </Button>
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-medium text-white">
              {activeCount}
            </span>
          )}
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2 rounded-[0.625rem] border border-line bg-surface p-3">
          <Select
            value={params.brand}
            onChange={(e) => apply({ brand: e.target.value })}
            className="w-auto!"
            aria-label="Brend"
          >
            <option value="">Barcha brendlar</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            value={params.platform}
            onChange={(e) =>
              apply({ platform: e.target.value as PlansParams["platform"] })
            }
            className="w-auto!"
            aria-label="Platforma"
          >
            <option value="">Barcha platformalar</option>
            {Object.entries(PLAN_PLATFORMS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          {(activeCount > 0 || params.q) && (
            <Button
              variant="ghost"
              onClick={() => {
                if (debounce.current) clearTimeout(debounce.current);
                setQ("");
                router.replace("/app/plan");
              }}
            >
              Tozalash
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/app/plan/PlansTable.tsx`**:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  buildPlansQuery,
  pageItems,
  PLAN_PAGE_SIZES,
  type PlansParams,
} from "@/lib/plansTable";
import { deletePlan } from "./actions";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

export type PlanRow = {
  id: string;
  title: string;
  period_start: string;
  post_count: number;
  brands: { name: string } | null;
};

export default function PlansTable({
  plans,
  params,
  total,
}: {
  plans: PlanRow[];
  params: PlansParams;
  total: number;
}) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const from = (params.page - 1) * params.size;
  const last = Math.max(1, Math.ceil(total / params.size));

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deletePlan(id);
      if (res.ok) {
        setConfirmId(null);
        setError(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-2.5 font-medium text-muted">Plan</th>
              <th className="hidden px-4 py-2.5 font-medium text-muted md:table-cell">
                Brend
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">
                Postlar
              </th>
              <th className="w-28 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/app/plan/${p.id}`)}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-canvas"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="font-mono text-xs text-muted">
                    {p.period_start.slice(0, 7)}
                  </p>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted md:table-cell">
                  {p.brands?.name ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {p.post_count} ta post
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {confirmId === p.id ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-muted">O‘chirilsinmi?</span>
                      <Button
                        variant="danger"
                        onClick={() => onDelete(p.id)}
                        disabled={pending}
                        className="px-1 py-0"
                      >
                        {pending ? "…" : "Ha"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmId(null)}
                        disabled={pending}
                        className="px-1 py-0"
                      >
                        Yo‘q
                      </Button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <Link
                        href={`/app/plan/${p.id}`}
                        aria-label="Tahrirlash"
                        className="text-muted transition-colors hover:text-accent"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => {
                          setConfirmId(p.id);
                          setError(null);
                        }}
                        aria-label="O‘chirish"
                        className="text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span className="font-mono tabular-nums">
          Natijalar: {from + 1}–{Math.min(from + params.size, total)} / {total}
        </span>
        <div className="flex items-center gap-1">
          {params.page > 1 ? (
            <Link href={`/app/plan${buildPlansQuery(params, { page: params.page - 1 })}`}>
              <Button variant="ghost" className="px-2 py-1.5" aria-label="Oldingi">
                ‹
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" disabled className="px-2 py-1.5" aria-label="Oldingi">
              ‹
            </Button>
          )}
          {pageItems(params.page, last).map((item, i) =>
            item === "…" ? (
              <span key={`e${i}`} className="px-1.5">
                …
              </span>
            ) : item === params.page ? (
              <span
                key={item}
                aria-current="page"
                className="flex h-8 min-w-8 items-center justify-center rounded-[0.625rem] bg-accent px-2 font-medium text-white"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={`/app/plan${buildPlansQuery(params, { page: item })}`}
                className="flex h-8 min-w-8 items-center justify-center rounded-[0.625rem] px-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                {item}
              </Link>
            )
          )}
          {params.page < last ? (
            <Link href={`/app/plan${buildPlansQuery(params, { page: params.page + 1 })}`}>
              <Button variant="ghost" className="px-2 py-1.5" aria-label="Keyingi">
                ›
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" disabled className="px-2 py-1.5" aria-label="Keyingi">
              ›
            </Button>
          )}
          <Select
            value={String(params.size)}
            onChange={(e) =>
              startTransition(() =>
                router.replace(
                  `/app/plan${buildPlansQuery(params, { size: Number(e.target.value), page: 1 })}`
                )
              )
            }
            className="ml-2 w-auto!"
            aria-label="Sahifa hajmi"
          >
            {PLAN_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
```

Accepted edge (do not "fix"): deleting the last row of a page > 1 leaves the page number in the URL; the refresh shows the no-match card whose "Filtrlarni tozalash" link recovers. Same policy as `?page=999`.

- [ ] **Step 4: Delete the superseded files**

```bash
git rm src/app/app/plan/PostsToolbar.tsx src/app/app/plan/PostsTable.tsx src/lib/planTable.ts src/lib/planTable.test.ts
```

Then confirm nothing still imports them: `grep -rn "PostsToolbar\|PostsTable\|lib/planTable" src/` → no matches.

- [ ] **Step 5: Verify**

Run: `npm test` — PASS (plansTable tests replace planTable's). `npx tsc --noEmit` clean. `npm run lint` clean. `npm run build` lists `ƒ /app/plan`. `grep -rn $'’' src/app/app/plan/ src/lib/plansTable.ts` → empty.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/app/plan/ src/lib/
git commit -m "feat: plans-list dashboard with filter panel, delete, numbered pagination"
```

---

### Task 4: End-to-end verification (browser)

- [ ] **Step 1:** Dev server, log in, `/app/plan` → plans table renders: search bar with sliders icon, rows with title + month subtitle, Brend, "N ta post", pencil/trash; newest first.
- [ ] **Step 2:** Search a title word → `?q=…`, rows narrow, focus retained; Tozalash (in the opened filter panel) clears box + URL.
- [ ] **Step 3:** Sliders icon → panel opens; filter by Brend and Platforma → badge count on the icon, `?brand=…&platform=…` in URL; reload → panel open by default with badge.
- [ ] **Step 4:** Row click → plan page with its posts; back; pencil → same page.
- [ ] **Step 5:** Trash → inline "O‘chirilsinmi? Ha / Yo‘q"; Yo‘q cancels; on a **disposable plan** (generate a cheap 1-post plan first if none), Ha deletes → row gone after refresh; plan page URL now 404s; `generations` row still present (check Supabase or skip with note).
- [ ] **Step 6:** Pagination: with size=10 and >10 plans (or set `?size=10` with 11+ plans; if not enough plans, verify with `?size=10` against what exists and note), numbered pages render, current highlighted, ‹ › work, size select 25 → URL `?size=25`, resets to page 1. `?page=999` → no-match card, no 500.
- [ ] **Step 7:** Gates: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — clean.

---

## Self-Review Notes

- **Spec coverage:** §2 layout (search+icon panel, columns, delete flow, pagination footer, empty states, sorting fixed newest-first) → Task 3; §3 query → Task 3 Step 1; §4 code changes incl. deletions and `bulkUpdateStatus` retention → Tasks 2–3; §5 pure-helper tests → Task 1; §6 error handling → Task 2 + parse defaults (Task 1).
- **Type consistency:** `PlansParams`/`buildPlansQuery`/`pageItems`/`PLAN_PAGE_SIZES` (Task 1) match usage in Task 3; `deletePlan` (Task 2) matches `PlansTable`'s call; `PlanRow` defined and consumed in Task 3.
- **Wireframe fidelity:** search bar with right-end filter icon ✓; edit/delete icons ✓; Plan/Brend/(Postlar) columns ✓; numbered pagination + results text + size select ✓.
- **Placeholder scan:** clean.
