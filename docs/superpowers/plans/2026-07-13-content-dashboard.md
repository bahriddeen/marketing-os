# Content Dashboard (posts table) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/app/plan` into a posts-first dashboard (search, filters, sorting, server-side pagination, bulk status changes, per-post summary/edit page) backed by a normalized `plan_posts` table.

**Architecture:** Migration 0004 moves posts out of `content_plans.posts` jsonb into `plan_posts` rows (with a new 4-value status) and drops the jsonb. All phase-3 consumers (generate route, plan detail, exports) switch to rows; edits become by-id updates. The dashboard is a server component driven entirely by URL search params, with client Toolbar/Table components for interactivity.

**Tech Stack:** Next.js 16 App Router (searchParams and route params are **Promises** — always `await`), Supabase (RLS `is_member()`), Zod v4, Tailwind v4 semantic tokens, vitest.

**Design spec:** `docs/superpowers/specs/2026-07-13-content-dashboard-design.md`

## Global Constraints

- All UI copy: Uzbek (Latin) only; apostrophe is **U+2018 (`‘`)**; never bare "AI" (use "sun‘iy intellekt"); `&apos;` only in literal JSX text.
- Colors: semantic utilities only (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `bg-accent-soft`, `border-line`, `bg-surface`, `text-danger`, plus new `info`/`warn` tokens added in Task 2) — no raw palette classes or hex in components.
- UI primitives from `src/components/ui/` (`Button`, `Input`, `Select`, `Textarea`, `Label`, `Card`).
- Tests colocated `src/**/*.test.ts`; gates per task: named vitest file, then `npm test`, `npx tsc --noEmit`; `npm run build` where routes/pages change.
- Commit after every task.
- **Runtime note:** Tasks 2–8 compile and commit without the DB migration, but any page touching posts is runtime-broken against the old schema. Apply migration 0004 (Task 1, user action in Supabase SQL editor) before Task 9's verification. Local dev during Tasks 2–8 is fine as long as you don't need the plan pages to render.

---

### Task 1: `plan_posts` migration

**Files:**
- Create: `supabase/migrations/0004_plan_posts.sql`

**Interfaces:**
- Produces: table `plan_posts` (columns: `id, plan_id, workspace_id, brand_id, date, topic, format, hook, cta, goal, status, position, created_at, updated_at`); `content_plans.posts` is dropped.

- [ ] **Step 1: Write the migration**

```sql
create table plan_posts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references content_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  date date not null,
  topic text not null,
  format text not null check (format in ('post','carousel','reels','story')),
  hook text not null default '',
  cta text not null default '',
  goal text not null default '',
  status text not null default 'qoralama'
    check (status in ('qoralama','jarayonda','tayyor','elon_qilingan')),
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plan_posts enable row level security;
create policy plan_posts_all on plan_posts for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

create index plan_posts_workspace_date_idx on plan_posts (workspace_id, date desc);
create index plan_posts_plan_idx on plan_posts (plan_id, position);

-- Backfill from the phase-3 jsonb, preserving order
insert into plan_posts (plan_id, workspace_id, brand_id, date, topic, format, hook, cta, goal, position)
select cp.id, cp.workspace_id, cp.brand_id,
       (p.value->>'date')::date, p.value->>'topic', p.value->>'format',
       coalesce(p.value->>'hook',''), coalesce(p.value->>'cta',''), coalesce(p.value->>'goal',''),
       p.ordinality
from content_plans cp, jsonb_array_elements(cp.posts) with ordinality p;

alter table content_plans drop column posts;
```

- [ ] **Step 2: Ask the user to apply it** in the Supabase SQL editor (project `mmfecqqpjpjzxwcbpcna`). This can happen any time before Task 9; don't block Tasks 2–8 on it, but remind the user now so it's not forgotten.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_plan_posts.sql
git commit -m "feat: add plan_posts table, backfill from jsonb, drop content_plans.posts"
```

---

### Task 2: Status constants, tokens, StatusBadge, row types

**Files:**
- Modify: `src/lib/plans.ts` (add statuses; keep `mergePlanPost` for now — removed in Task 4)
- Modify: `src/lib/plans.test.ts` (append status tests)
- Modify: `src/lib/types.ts` (add `PlanPostRow`, drop `posts` from `ContentPlan`)
- Modify: `src/app/globals.css` (info/warn tokens in all four token blocks + `@theme inline`)
- Create: `src/components/ui/StatusBadge.tsx`

**Interfaces:**
- Produces: `PLAN_STATUS_LABELS: Record<PlanStatus, string>`, `PLAN_STATUS_VALUES` tuple, type `PlanStatus = "qoralama" | "jarayonda" | "tayyor" | "elon_qilingan"` from `@/lib/plans`; type `PlanPostRow` from `@/lib/types`; `<StatusBadge status={...} />` component; Tailwind utilities `text-info`, `bg-info-soft`, `text-warn`, `bg-warn-soft`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/plans.test.ts`:

```ts
import { PLAN_STATUS_VALUES, PLAN_STATUS_LABELS } from "./plans";

describe("plan statuses", () => {
  it("has the four spec statuses in order", () => {
    expect(PLAN_STATUS_VALUES).toEqual([
      "qoralama",
      "jarayonda",
      "tayyor",
      "elon_qilingan",
    ]);
  });
  it("labels every status in Uzbek", () => {
    expect(PLAN_STATUS_LABELS.qoralama).toBe("Qoralama");
    expect(PLAN_STATUS_LABELS.jarayonda).toBe("Jarayonda");
    expect(PLAN_STATUS_LABELS.tayyor).toBe("Tayyor");
    expect(PLAN_STATUS_LABELS.elon_qilingan).toBe("E‘lon qilingan");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/plans.test.ts` — Expected: FAIL (`PLAN_STATUS_VALUES` not exported).

- [ ] **Step 3: Implement** — append to `src/lib/plans.ts`:

```ts
export const PLAN_STATUS_VALUES = [
  "qoralama",
  "jarayonda",
  "tayyor",
  "elon_qilingan",
] as const;
export type PlanStatus = (typeof PLAN_STATUS_VALUES)[number];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  qoralama: "Qoralama",
  jarayonda: "Jarayonda",
  tayyor: "Tayyor",
  elon_qilingan: "E‘lon qilingan",
};
```

In `src/lib/types.ts`, add below `ContentPlan` (and change `ContentPlan`: delete its `posts: PlanPost[];` line; the `PlanPost` import stays for now — Task 4 may remove it if unused):

```ts
import type { PlanStatus } from "@/lib/plans";

export type PlanPostRow = {
  id: string;
  plan_id: string;
  workspace_id: string;
  brand_id: string;
  date: string;
  topic: string;
  format: "post" | "carousel" | "reels" | "story";
  hook: string;
  cta: string;
  goal: string;
  status: PlanStatus;
  position: number;
  created_at: string;
  updated_at: string;
};
```

In `src/app/globals.css`, add to the **light `:root`** block (after `--danger`):

```css
  --info: #1E5FA8;
  --info-soft: #E3EDF8;
  --warn: #8A5A00;
  --warn-soft: #F6EED9;
```

to **both dark blocks** (the `@media (prefers-color-scheme: dark)` `:root` and the `:root[data-theme="dark"], .theme-dark-pinned` block):

```css
  --info: #6FA8E8;
  --info-soft: #182A40;
  --warn: #D9A94A;
  --warn-soft: #3A2E14;
```

to the **light-pinned** block (`:root[data-theme="light"]`-style block near line 60, matching how `--accent-soft: #E3F3EA;` is repeated there):

```css
  --info: #1E5FA8;
  --info-soft: #E3EDF8;
  --warn: #8A5A00;
  --warn-soft: #F6EED9;
```

and to `@theme inline`:

```css
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --color-warn: var(--warn);
  --color-warn-soft: var(--warn-soft);
```

Create `src/components/ui/StatusBadge.tsx`:

```tsx
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";

const TONES: Record<PlanStatus, string> = {
  qoralama: "bg-canvas text-muted",
  jarayonda: "bg-info-soft text-info",
  tayyor: "bg-warn-soft text-warn",
  elon_qilingan: "bg-accent-soft text-accent",
};

export default function StatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs font-medium ${TONES[status]}`}
    >
      {PLAN_STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/plans.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean. (If `ContentPlan`'s removed `posts` field breaks `/app/plan/[id]/page.tsx`, leave that page as-is for now only if it still compiles; if it does **not** compile, change the cast there to `ContentPlan & { posts: PlanPost[]; brands: { name: string } | null }` temporarily — Task 4 rewrites that page.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans.ts src/lib/plans.test.ts src/lib/types.ts src/app/globals.css src/components/ui/StatusBadge.tsx
git commit -m "feat: add post statuses, info/warn tokens, StatusBadge"
```

---

### Task 3: Table params helpers (pure)

**Files:**
- Create: `src/lib/planTable.ts`
- Test: `src/lib/planTable.test.ts`

**Interfaces:**
- Consumes: `PlanStatus`/`PLAN_STATUS_VALUES` (Task 2), `PlanPlatform`/`PLAN_PLATFORMS` and format keys from `@/lib/ai/modules/contentPlan`.
- Produces: `PAGE_SIZE = 25`; type `TableParams = { q: string; brand: string; status: PlanStatus | ""; format: "post"|"carousel"|"reels"|"story" | ""; platform: PlanPlatform | ""; sort: "date"|"topic"; dir: "asc"|"desc"; page: number }`; `parseTableParams(sp: Record<string, string | string[] | undefined>): TableParams`; `buildTableQuery(params: TableParams, overrides?: Partial<TableParams>): string` (returns `""` or `"?k=v&…"`, omitting default values, always omitting `page` when 1).

- [ ] **Step 1: Write the failing tests** — `src/lib/planTable.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTableParams, buildTableQuery, PAGE_SIZE } from "./planTable";

describe("parseTableParams", () => {
  it("returns defaults for empty input", () => {
    expect(parseTableParams({})).toEqual({
      q: "",
      brand: "",
      status: "",
      format: "",
      platform: "",
      sort: "date",
      dir: "desc",
      page: 1,
    });
  });

  it("accepts valid values", () => {
    const p = parseTableParams({
      q: "aksiya",
      brand: "b1",
      status: "tayyor",
      format: "reels",
      platform: "both",
      sort: "topic",
      dir: "asc",
      page: "3",
    });
    expect(p).toEqual({
      q: "aksiya",
      brand: "b1",
      status: "tayyor",
      format: "reels",
      platform: "both",
      sort: "topic",
      dir: "asc",
      page: 3,
    });
  });

  it("falls back to defaults on hostile values, never throws", () => {
    const p = parseTableParams({
      status: "hacked",
      format: "video",
      platform: "tiktok",
      sort: "id; drop table",
      dir: "sideways",
      page: "-5",
      q: ["a", "b"] as unknown as string,
    });
    expect(p.status).toBe("");
    expect(p.format).toBe("");
    expect(p.platform).toBe("");
    expect(p.sort).toBe("date");
    expect(p.dir).toBe("desc");
    expect(p.page).toBe(1);
    expect(p.q).toBe("a"); // first value of array
  });

  it("exports PAGE_SIZE 25", () => {
    expect(PAGE_SIZE).toBe(25);
  });
});

describe("buildTableQuery", () => {
  const defaults = parseTableParams({});

  it("returns empty string for all-default params", () => {
    expect(buildTableQuery(defaults)).toBe("");
  });

  it("serializes non-defaults and applies overrides", () => {
    const p = { ...defaults, status: "tayyor" as const, page: 2 };
    expect(buildTableQuery(p)).toBe("?status=tayyor&page=2");
    expect(buildTableQuery(p, { page: 1 })).toBe("?status=tayyor");
    expect(buildTableQuery(p, { dir: "asc" })).toBe("?status=tayyor&dir=asc&page=2");
  });

  it("url-encodes the search query", () => {
    expect(buildTableQuery({ ...defaults, q: "yozgi aksiya" })).toBe(
      "?q=yozgi%20aksiya"
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/planTable.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `src/lib/planTable.ts`:

```ts
import { PLAN_STATUS_VALUES, type PlanStatus } from "@/lib/plans";
import { PLAN_PLATFORMS, type PlanPlatform } from "@/lib/ai/modules/contentPlan";

export const PAGE_SIZE = 25;

const FORMATS = ["post", "carousel", "reels", "story"] as const;
type PostFormat = (typeof FORMATS)[number];

export type TableParams = {
  q: string;
  brand: string;
  status: PlanStatus | "";
  format: PostFormat | "";
  platform: PlanPlatform | "";
  sort: "date" | "topic";
  dir: "asc" | "desc";
  page: number;
};

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

const oneOf = <T extends string>(v: string, allowed: readonly T[]): T | "" =>
  (allowed as readonly string[]).includes(v) ? (v as T) : "";

export function parseTableParams(
  sp: Record<string, string | string[] | undefined>
): TableParams {
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1);
  return {
    q: first(sp.q).slice(0, 200),
    brand: first(sp.brand),
    status: oneOf(first(sp.status), PLAN_STATUS_VALUES),
    format: oneOf(first(sp.format), FORMATS),
    platform: oneOf(
      first(sp.platform),
      Object.keys(PLAN_PLATFORMS) as PlanPlatform[]
    ),
    sort: oneOf(first(sp.sort), ["date", "topic"] as const) || "date",
    dir: oneOf(first(sp.dir), ["asc", "desc"] as const) || "desc",
    page,
  };
}

export function buildTableQuery(
  params: TableParams,
  overrides: Partial<TableParams> = {}
): string {
  const p = { ...params, ...overrides };
  const parts: string[] = [];
  if (p.q) parts.push(`q=${encodeURIComponent(p.q)}`);
  if (p.brand) parts.push(`brand=${encodeURIComponent(p.brand)}`);
  if (p.status) parts.push(`status=${p.status}`);
  if (p.format) parts.push(`format=${p.format}`);
  if (p.platform) parts.push(`platform=${p.platform}`);
  if (p.sort !== "date") parts.push(`sort=${p.sort}`);
  if (p.dir !== "desc") parts.push(`dir=${p.dir}`);
  if (p.page > 1) parts.push(`page=${p.page}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/planTable.test.ts` — Expected: PASS. Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planTable.ts src/lib/planTable.test.ts
git commit -m "feat: add dashboard table param parsing and URL building"
```

---

### Task 4: Switch actions + plan detail page to `plan_posts` rows

**Files:**
- Rewrite: `src/app/app/plan/actions.ts`
- Modify: `src/lib/plans.ts` (delete `mergePlanPost` + `PlanPostEdit`)
- Modify: `src/lib/plans.test.ts` (delete `mergePlanPost` tests and the `posts` fixture)
- Modify: `src/lib/types.ts` (remove the now-unused `PlanPost` import if nothing else uses it)
- Modify: `src/app/app/plan/[id]/page.tsx`
- Rewrite: `src/app/app/plan/[id]/PlanTable.tsx`

**Interfaces:**
- Consumes: `PlanPostRow` (Task 2), `PLAN_STATUS_VALUES` (Task 2), `StatusBadge` (Task 2).
- Produces: server actions `updatePlanPost(postId: string, edit: PostEditInput): Promise<{ ok: true } | { ok: false; error: string }>` where `PostEditInput = Partial<{ topic: string; format: "post"|"carousel"|"reels"|"story"; hook: string; cta: string; goal: string; status: PlanStatus }>`; `bulkUpdateStatus(ids: string[], status: PlanStatus): Promise<{ ok: true; updated: number } | { ok: false; error: string }>`.

- [ ] **Step 1: Rewrite `src/app/app/plan/actions.ts`**

```ts
"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PLAN_STATUS_VALUES } from "@/lib/plans";

const PostEditSchema = z
  .object({
    topic: z.string().min(1),
    format: z.enum(["post", "carousel", "reels", "story"]),
    hook: z.string(),
    cta: z.string(),
    goal: z.string(),
    status: z.enum(PLAN_STATUS_VALUES),
  })
  .partial();
export type PostEditInput = z.infer<typeof PostEditSchema>;

export async function updatePlanPost(
  postId: string,
  edit: PostEditInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = PostEditSchema.safeParse(edit);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_posts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  revalidatePath("/app/plan");
  return { ok: true };
}

const BulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(PLAN_STATUS_VALUES),
});

export async function bulkUpdateStatus(
  ids: string[],
  status: string
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const parsed = BulkStatusSchema.safeParse({ ids, status });
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri so‘rov." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_posts")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .select("id");
  if (error) {
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  revalidatePath("/app/plan");
  return { ok: true, updated: (data ?? []).length };
}
```

- [ ] **Step 2: Delete `mergePlanPost`** — in `src/lib/plans.ts` remove `PlanPostEdit`, `mergePlanPost`, and the `import type { PlanPost }` if now unused (`planFilename` and the status exports stay). In `src/lib/plans.test.ts` remove the `mergePlanPost` describe block, the `posts` fixture, and the `PlanPost` import (keep `planFilename` + status tests). In `src/lib/types.ts` remove the `PlanPost` import and keep `ContentPlan` (without `posts`) — it still types plan metadata.

- [ ] **Step 3: Update the detail page** — `src/app/app/plan/[id]/page.tsx`: replace the plan query/casting so posts come from `plan_posts`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PlanTable from "./PlanTable";
import type { ContentPlan, PlanPostRow } from "@/lib/types";

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

  const { data: postsData } = await supabase
    .from("plan_posts")
    .select("*")
    .eq("plan_id", id)
    .order("position", { ascending: true });
  const posts = (postsData ?? []) as PlanPostRow[];

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
      <PlanTable initialPosts={posts} />
      <Link
        className="inline-block text-sm font-medium text-accent hover:underline"
        href="/app/plan"
      >
        ← Barcha postlar
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/app/app/plan/[id]/PlanTable.tsx`** — same inline editing UX as phase 3 but keyed by post id, plus a status badge column and an "Ochish" link to the post page:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { PlanPostRow } from "@/lib/types";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";
import { updatePlanPost } from "../actions";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Select, Textarea } from "@/components/ui/Input";

const COLUMNS = ["Sana", "Mavzu", "Format", "Holat", "Hook", "CTA", "Maqsad", ""];

export default function PlanTable({ initialPosts }: { initialPosts: PlanPostRow[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanPostRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(p: PlanPostRow) {
    setEditingId(p.id);
    setDraft(p);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    const next = draft;
    startTransition(async () => {
      const res = await updatePlanPost(next.id, {
        topic: next.topic,
        format: next.format,
        hook: next.hook,
        cta: next.cta,
        goal: next.goal,
      });
      if (res.ok) {
        setPosts((ps) => ps.map((p) => (p.id === next.id ? next : p)));
        cancelEdit();
      } else {
        setError(res.error);
      }
    });
  }

  const set = (field: "topic" | "hook" | "cta" | "goal") => (value: string) =>
    setDraft((d) => (d ? { ...d, [field]: value } : d));

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {COLUMNS.map((c, i) => (
                <th key={i} className="px-3 py-2.5 font-medium text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p) =>
              editingId === p.id && draft ? (
                <tr key={p.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted">
                    {p.date}
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.topic}
                      onChange={(e) => set("topic")(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={draft.format}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? { ...d, format: e.target.value as PlanPostRow["format"] }
                            : d
                        )
                      }
                    >
                      {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.hook}
                      onChange={(e) => set("hook")(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.cta}
                      onChange={(e) => set("cta")(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.goal}
                      onChange={(e) => set("goal")(e.target.value)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      <Button onClick={saveEdit} disabled={pending} className="px-3 py-1.5">
                        {pending ? "Saqlanmoqda…" : "Saqlash"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={cancelEdit}
                        disabled={pending}
                        className="px-3 py-1.5"
                      >
                        Bekor qilish
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted">
                    {p.date}
                  </td>
                  <td className="px-3 py-2 text-ink">{p.topic}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {PLAN_FORMAT_LABELS[p.format]}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2 text-ink">{p.hook}</td>
                  <td className="px-3 py-2 text-ink">{p.cta}</td>
                  <td className="px-3 py-2 text-muted">{p.goal}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-left text-sm font-medium text-accent hover:underline"
                      >
                        Tahrirlash
                      </button>
                      <Link
                        href={`/app/plan/post/${p.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Ochish
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm test` — PASS (mergePlanPost tests removed). Run: `npx tsc --noEmit` — clean. `npm run build` — compiles.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/plan/actions.ts src/lib/plans.ts src/lib/plans.test.ts src/lib/types.ts "src/app/app/plan/[id]/page.tsx" "src/app/app/plan/[id]/PlanTable.tsx"
git commit -m "feat: switch plan detail and edit actions to plan_posts rows"
```

---

### Task 5: Generate route inserts `plan_posts` rows

**Files:**
- Modify: `src/app/api/generate/content-plan/route.ts` (the insert section only)

**Interfaces:**
- Consumes: existing `runStructuredGeneration` result (`result.data.posts: PlanPost[]`, `result.generationId`).
- Produces: unchanged API contract `{ ok: true, planId, creditsLeft }`.

- [ ] **Step 1: Replace the plan-insert block** — in `route.ts`, replace everything from `const { data: plan, error } = await supabase` through the final success `return` with:

```ts
  const { data: plan, error } = await supabase
    .from("content_plans")
    .insert({
      workspace_id: ws.id,
      brand_id: brand.id,
      user_id: user.id,
      title: result.data.title,
      platform,
      goal,
      period_start: String(periodStart),
      post_count: result.data.posts.length,
      generation_id: result.generationId,
    })
    .select("id")
    .single();

  if (error || !plan) {
    console.error("content plan insert failed", error);
    return NextResponse.json(
      { ok: false, error: "Planni saqlab bo‘lmadi. Qayta urinib ko‘ring." },
      { status: 500 }
    );
  }

  const rows = result.data.posts.map((p, i) => ({
    plan_id: plan.id,
    workspace_id: ws.id,
    brand_id: brand.id,
    date: p.date,
    topic: p.topic,
    format: p.format,
    hook: p.hook,
    cta: p.cta,
    goal: p.goal,
    position: i + 1,
  }));
  const { error: postsError } = await supabase.from("plan_posts").insert(rows);
  if (postsError) {
    console.error("plan posts insert failed", postsError);
    await supabase.from("content_plans").delete().eq("id", plan.id);
    return NextResponse.json(
      { ok: false, error: "Planni saqlab bo‘lmadi. Qayta urinib ko‘ring." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, planId: plan.id, creditsLeft: result.creditsLeft });
```

(Status is intentionally omitted — the DB default `qoralama` applies.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — clean. `npm run build` — compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/content-plan/route.ts
git commit -m "feat: persist generated posts as plan_posts rows"
```

---

### Task 6: Exports read rows and gain a Holat column

**Files:**
- Modify: `src/lib/planExport.ts`
- Modify: `src/lib/planExport.test.ts`
- Modify: `src/app/api/plans/[id]/export/route.ts`

**Interfaces:**
- Consumes: `PlanStatus`/`PLAN_STATUS_LABELS` (Task 2).
- Produces: `PlanExportPost = { date: string; topic: string; format: "post"|"carousel"|"reels"|"story"; hook: string; cta: string; goal: string; status: PlanStatus }`; `planRows`/`planToCsv`/`planToXlsx` now take `PlanExportPost[]`; headers are `["Sana","Mavzu","Format","Hook","CTA","Maqsad","Holat"]`.

- [ ] **Step 1: Update the tests** — in `src/lib/planExport.test.ts`, change the fixture and expectations:

```ts
import { describe, it, expect } from "vitest";
import { PLAN_EXPORT_HEADERS, planRows, planToCsv, planToXlsx, type PlanExportPost } from "./planExport";

const posts: PlanExportPost[] = [
  {
    date: "2026-08-01",
    topic: 'Mavzu, "qo‘shtirnoq" bilan',
    format: "carousel",
    hook: "Ko‘p qatorli\nhook",
    cta: "Yozing",
    goal: "Faollik",
    status: "elon_qilingan",
  },
];

describe("planRows", () => {
  it("maps posts to rows with Uzbek format and status labels", () => {
    expect(planRows(posts)).toEqual([
      [
        "2026-08-01",
        'Mavzu, "qo‘shtirnoq" bilan',
        "Karusel",
        "Ko‘p qatorli\nhook",
        "Yozing",
        "Faollik",
        "E‘lon qilingan",
      ],
    ]);
  });
});

describe("planToCsv", () => {
  it("starts with a UTF-8 BOM and the header row incl. Holat", () => {
    const csv = planToCsv(posts);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(PLAN_EXPORT_HEADERS).toEqual(["Sana", "Mavzu", "Format", "Hook", "CTA", "Maqsad", "Holat"]);
    expect(csv).toContain(PLAN_EXPORT_HEADERS.join(","));
  });

  it("quotes cells containing commas, quotes or newlines (RFC 4180)", () => {
    const csv = planToCsv(posts);
    expect(csv).toContain('"Mavzu, ""qo‘shtirnoq"" bilan"');
    expect(csv).toContain('"Ko‘p qatorli\nhook"');
  });
});

describe("planToXlsx", () => {
  it("produces a non-empty zip (xlsx) buffer", async () => {
    const buf = await planToXlsx("Test plan", posts);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/planExport.test.ts` → FAIL (`PlanExportPost` not exported, Holat missing).

- [ ] **Step 3: Update the implementation** — `src/lib/planExport.ts`:

```ts
import ExcelJS from "exceljs";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";

export type PlanExportPost = {
  date: string;
  topic: string;
  format: "post" | "carousel" | "reels" | "story";
  hook: string;
  cta: string;
  goal: string;
  status: PlanStatus;
};

export const PLAN_EXPORT_HEADERS = ["Sana", "Mavzu", "Format", "Hook", "CTA", "Maqsad", "Holat"];

export function planRows(posts: PlanExportPost[]): string[][] {
  return posts.map((p) => [
    p.date,
    p.topic,
    PLAN_FORMAT_LABELS[p.format],
    p.hook,
    p.cta,
    p.goal,
    PLAN_STATUS_LABELS[p.status],
  ]);
}

const csvCell = (v: string) =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export function planToCsv(posts: PlanExportPost[]): string {
  const lines = [PLAN_EXPORT_HEADERS, ...planRows(posts)].map((row) =>
    row.map(csvCell).join(",")
  );
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export async function planToXlsx(
  title: string,
  posts: PlanExportPost[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.replace(/[\\/?*[\]]/g, " ").slice(0, 31) || "Kontent-plan");
  ws.columns = [
    { header: "Sana", width: 12 },
    { header: "Mavzu", width: 44 },
    { header: "Format", width: 12 },
    { header: "Hook", width: 44 },
    { header: "CTA", width: 32 },
    { header: "Maqsad", width: 32 },
    { header: "Holat", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const row of planRows(posts)) ws.addRow(row);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}
```

- [ ] **Step 4: Update the route** — `src/app/api/plans/[id]/export/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { planToCsv, planToXlsx, type PlanExportPost } from "@/lib/planExport";
import { planFilename } from "@/lib/plans";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("content_plans")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  if (!plan) {
    return new Response("Topilmadi", { status: 404 });
  }

  const { data: postsData } = await supabase
    .from("plan_posts")
    .select("date, topic, format, hook, cta, goal, status")
    .eq("plan_id", id)
    .order("position", { ascending: true });
  const posts = (postsData ?? []) as PlanExportPost[];

  if (format === "csv") {
    return new Response(planToCsv(posts), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${planFilename(plan.title, "csv")}"`,
      },
    });
  }

  const buf = await planToXlsx(plan.title, posts);
  return new Response(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${planFilename(plan.title, "xlsx")}"`,
    },
  });
}
```

- [ ] **Step 5: Verify** — `npx vitest run src/lib/planExport.test.ts` PASS; `npm test` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/planExport.ts src/lib/planExport.test.ts "src/app/api/plans/[id]/export/route.ts"
git commit -m "feat: export plan posts from rows with Holat column"
```

---

### Task 7: Dashboard page — toolbar, table, bulk bar, pagination

**Files:**
- Rewrite: `src/app/app/plan/page.tsx`
- Create: `src/app/app/plan/PostsToolbar.tsx`
- Create: `src/app/app/plan/PostsTable.tsx`

**Interfaces:**
- Consumes: `parseTableParams`/`buildTableQuery`/`PAGE_SIZE`/`TableParams` (Task 3), `bulkUpdateStatus` (Task 4), `StatusBadge` (Task 2), `PLAN_STATUS_LABELS`/`PLAN_STATUS_VALUES`, `PLAN_FORMAT_LABELS`/`PLAN_PLATFORMS`.
- Produces: type `DashboardPost` (exported from `PostsTable.tsx`): `{ id: string; date: string; topic: string; hook: string; format: "post"|"carousel"|"reels"|"story"; status: PlanStatus; plan_id: string; content_plans: { title: string; platform: PlanPlatform } | null; brands: { name: string } | null }`.

- [ ] **Step 1: Rewrite `src/app/app/plan/page.tsx`** (server component; Next 16 — `searchParams` is a Promise):

```tsx
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
              <PostsTable posts={posts} params={p} />
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
```

- [ ] **Step 2: Create `src/app/app/plan/PostsToolbar.tsx`**:

```tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { buildTableQuery, type TableParams } from "@/lib/planTable";
import { PLAN_STATUS_LABELS } from "@/lib/plans";
import { PLAN_FORMAT_LABELS, PLAN_PLATFORMS } from "@/lib/ai/modules/contentPlan";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type BrandOption = { id: string; name: string };

export default function PostsToolbar({
  brands,
  params,
}: {
  brands: BrandOption[];
  params: TableParams;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep local search box in sync when URL changes externally (e.g. Tozalash)
  useEffect(() => setQ(params.q), [params.q]);

  function apply(overrides: Partial<TableParams>) {
    startTransition(() => {
      router.replace(`/app/plan${buildTableQuery(params, { ...overrides, page: 1 })}`);
    });
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value }), 300);
  }

  const hasFilters =
    !!params.q || !!params.brand || !!params.status || !!params.format || !!params.platform;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Mavzu yoki hook bo‘yicha qidirish…"
          className="pl-9"
          aria-label="Qidirish"
        />
      </div>
      <Select
        value={params.brand}
        onChange={(e) => apply({ brand: e.target.value })}
        className="w-auto"
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
        value={params.status}
        onChange={(e) => apply({ status: e.target.value as TableParams["status"] })}
        className="w-auto"
        aria-label="Holat"
      >
        <option value="">Barcha holatlar</option>
        {Object.entries(PLAN_STATUS_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        value={params.format}
        onChange={(e) => apply({ format: e.target.value as TableParams["format"] })}
        className="w-auto"
        aria-label="Format"
      >
        <option value="">Barcha formatlar</option>
        {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        value={params.platform}
        onChange={(e) => apply({ platform: e.target.value as TableParams["platform"] })}
        className="w-auto"
        aria-label="Platforma"
      >
        <option value="">Barcha platformalar</option>
        {Object.entries(PLAN_PLATFORMS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      {hasFilters && (
        <Button variant="ghost" onClick={() => router.replace("/app/plan")}>
          Tozalash
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/app/plan/PostsTable.tsx`**:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { buildTableQuery, type TableParams } from "@/lib/planTable";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";
import { PLAN_FORMAT_LABELS, type PlanPlatform } from "@/lib/ai/modules/contentPlan";
import { bulkUpdateStatus } from "./actions";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Select } from "@/components/ui/Input";

export type DashboardPost = {
  id: string;
  date: string;
  topic: string;
  hook: string;
  format: "post" | "carousel" | "reels" | "story";
  status: PlanStatus;
  plan_id: string;
  content_plans: { title: string; platform: PlanPlatform } | null;
  brands: { name: string } | null;
};

function SortHeader({
  label,
  field,
  params,
}: {
  label: string;
  field: TableParams["sort"];
  params: TableParams;
}) {
  const active = params.sort === field;
  const nextDir = active && params.dir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={`/app/plan${buildTableQuery(params, { sort: field, dir: nextDir, page: 1 })}`}
      className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
    >
      {label}
      {active &&
        (params.dir === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
    </Link>
  );
}

export default function PostsTable({
  posts,
  params,
}: {
  posts: DashboardPost[];
  params: TableParams;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PlanStatus>("tayyor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = posts.length > 0 && posts.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulk() {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateStatus(ids, bulkStatus);
      if (res.ok) {
        setSelected(new Set());
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
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[0.625rem] border border-line bg-accent-soft px-4 py-2.5">
          <span className="text-sm font-medium text-ink">
            {selected.size} ta tanlandi
          </span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PlanStatus)}
            className="w-auto"
            aria-label="Yangi holat"
          >
            {Object.entries(PLAN_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          <Button onClick={applyBulk} disabled={pending} className="px-3 py-1.5">
            {pending ? "Saqlanmoqda…" : "Qo‘llash"}
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            aria-label="Tanlovni bekor qilish"
            className="ml-auto text-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Barchasini tanlash"
                  className="accent-[var(--accent)]"
                />
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted">
                <SortHeader label="Sana" field="date" params={params} />
              </th>
              <th className="px-3 py-2.5 font-medium text-muted">
                <SortHeader label="Mavzu" field="topic" params={params} />
              </th>
              <th className="px-3 py-2.5 font-medium text-muted">Format</th>
              <th className="px-3 py-2.5 font-medium text-muted">Holat</th>
              <th className="hidden px-3 py-2.5 font-medium text-muted md:table-cell">
                Brend
              </th>
              <th className="hidden px-3 py-2.5 font-medium text-muted md:table-cell">
                Plan
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/app/plan/post/${p.id}`)}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-canvas"
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label="Tanlash"
                    className="accent-[var(--accent)]"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-muted">
                  {p.date}
                </td>
                <td className="max-w-96 px-3 py-2.5">
                  <p className="truncate font-medium text-ink">{p.topic}</p>
                  <p className="truncate text-xs text-muted">{p.hook}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                  {PLAN_FORMAT_LABELS[p.format]}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge status={p.status} />
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted md:table-cell">
                  {p.brands?.name ?? "—"}
                </td>
                <td
                  className="hidden max-w-48 px-3 py-2.5 md:table-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/app/plan/${p.plan_id}`}
                    className="block truncate font-medium text-accent hover:underline"
                  >
                    {p.content_plans?.title ?? "—"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Note on `accent-[var(--accent)]`: native checkboxes can't take background utilities; `accent-color` via the CSS variable keeps it on-token (no raw palette).

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npm run build` compiles and lists `ƒ /app/plan`.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/plan/page.tsx src/app/app/plan/PostsToolbar.tsx src/app/app/plan/PostsTable.tsx
git commit -m "feat: posts dashboard with search, filters, sorting, pagination, bulk status"
```

---

### Task 8: Post summary page

**Files:**
- Create: `src/app/app/plan/post/[id]/page.tsx`
- Create: `src/app/app/plan/post/[id]/PostForm.tsx`

**Interfaces:**
- Consumes: `updatePlanPost` (Task 4), `PlanPostRow` (Task 2), `PLAN_STATUS_LABELS`, `PLAN_FORMAT_LABELS`, `StatusBadge`, UI primitives.
- Produces: `/app/plan/post/[id]` route.

- [ ] **Step 1: Server page** — `src/app/app/plan/post/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Edit form** — `src/app/app/plan/post/[id]/PostForm.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import type { PlanPostRow } from "@/lib/types";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";
import { updatePlanPost } from "../../actions";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Input";

export default function PostForm({ post }: { post: PlanPostRow }) {
  const [topic, setTopic] = useState(post.topic);
  const [format, setFormat] = useState(post.format);
  const [status, setStatus] = useState<PlanStatus>(post.status);
  const [hook, setHook] = useState(post.hook);
  const [cta, setCta] = useState(post.cta);
  const [goal, setGoal] = useState(post.goal);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setSaved(false);
    startTransition(async () => {
      const res = await updatePlanPost(post.id, {
        topic,
        format,
        status,
        hook,
        cta,
        goal,
      });
      if (res.ok) {
        setSaved(true);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card className="space-y-4">
      <label className="block">
        <Label>Mavzu</Label>
        <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <Label>Format</Label>
          <Select
            value={format}
            onChange={(e) => setFormat(e.target.value as PlanPostRow["format"])}
          >
            {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label>Holat</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as PlanStatus)}
          >
            {Object.entries(PLAN_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="block">
        <Label>Hook</Label>
        <Textarea rows={3} value={hook} onChange={(e) => setHook(e.target.value)} />
      </label>
      <label className="block">
        <Label>CTA</Label>
        <Textarea rows={2} value={cta} onChange={(e) => setCta(e.target.value)} />
      </label>
      <label className="block">
        <Label>Maqsad</Label>
        <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || topic.trim().length === 0}>
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        {saved && <span className="text-sm font-medium text-accent">Saqlandi ✓</span>}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm run build` lists `ƒ /app/plan/post/[id]`; `npm test` PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/plan/post/
git commit -m "feat: add post summary page with full edit form"
```

---

### Task 9: Apply migration + end-to-end verification

**Blocks on:** migration 0004 applied in the Supabase SQL editor (Task 1 Step 2).

- [ ] **Step 1:** Confirm with the user that migration 0004 ran successfully (existing posts backfilled — check `select count(*) from plan_posts;` roughly equals the sum of old plan post counts).
- [ ] **Step 2:** `npm run dev` (or reuse the running server), log in, open `/app/plan` → table of existing posts renders, newest date first, statuses all "Qoralama".
- [ ] **Step 3:** Search a word from a known topic → rows narrow; check URL carries `?q=…`; clear with Tozalash.
- [ ] **Step 4:** Filter by Brend, Holat, Format, Platforma (each individually) → counts change accordingly; combine two filters; "Hech narsa topilmadi" state with a nonsense search.
- [ ] **Step 5:** Sort by Sana (toggle asc/desc) and Mavzu → order flips; arrow indicator follows.
- [ ] **Step 6:** If total posts ≤ 25, generate another plan (10 posts) to cross the page boundary → pagination footer shows "1–25 / N", Keyingi/Oldingi work, filters persist across pages.
- [ ] **Step 7:** Select 3 rows → bulk bar appears; set Holat "Tayyor", Qo‘llash → badges update after refresh; select-all checkbox selects the page.
- [ ] **Step 8:** Click a row → post summary page; edit Mavzu + Holat → Saqlandi ✓; back to dashboard → changes visible; verify the plan detail page (`/app/plan/[id]`) still inline-edits and shows status badges.
- [ ] **Step 9:** Export xlsx + CSV from a plan detail page → files download, Holat column present with Uzbek labels.
- [ ] **Step 10:** Generate a fresh plan end-to-end → posts appear in dashboard as Qoralama; credits −10.
- [ ] **Step 11:** Gates: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean. Commit anything outstanding.

---

## Self-Review Notes

- **Spec coverage:** §2 data model → Task 1; statuses/tokens/badge → Task 2; §3 phase-3 migration → Tasks 4 (detail/actions), 5 (generate), 6 (exports); §4 dashboard (URL state, toolbar, table, bulk, pagination, empty states, responsive) → Tasks 3 + 7; §5 post page → Task 8; §7 testing list → Tasks 2, 3, 6 (parseTableParams, statuses, Holat export, bulk zod validation lives in Task 4's action and is covered by Task 3's hostile-input tests at the param layer plus zod in the action); §8 error handling → parseTableParams defaults (Task 3), action results (Task 4), notFound (Task 8).
- **Type consistency:** `PlanStatus`/`PLAN_STATUS_VALUES`/`PLAN_STATUS_LABELS` (Task 2) used in Tasks 3, 4, 6, 7, 8; `updatePlanPost(postId, edit)` signature identical in Tasks 4 (definition), 4 Step 4 (PlanTable), 8 (PostForm); `DashboardPost` defined in Task 7 and used only there; `PlanExportPost` defined and consumed in Task 6.
- **Order safety:** every task compiles and passes tests on its own; runtime correctness against the DB flips at migration time, gated by Task 9 Step 1.
- **Out of scope honored:** no bulk delete, no saved views, no column controls, no date editing.
