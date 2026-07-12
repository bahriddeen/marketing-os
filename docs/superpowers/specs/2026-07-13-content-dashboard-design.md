# Content Dashboard (posts table) — Design

**Date:** 2026-07-13
**Status:** Approved
**Supersedes:** the card-based plans list at `/app/plan` (built in phase 3, `2026-07-12-content-planner-design.md`)

## 1. Summary

`/app/plan` becomes a posts-first dashboard: one table row per generated post across all plans, with search, filtering, sorting, server-side pagination, bulk status changes, and a per-post summary/edit page. Modeled on the toolbar-over-table pattern used by Linear/Airtable-class SaaS dashboards: URL-driven state, contextual bulk-action bar, distinct empty states.

Decisions from brainstorming:

- **Rows are posts, not plans** — that's where hundreds–thousands of items come from; plans stay reachable through a Plan column link and the post-generation redirect.
- **Posts get a status** (four values, Uzbek labels, default `qoralama`).
- **Posts are normalized into a `plan_posts` table** — search/sort/pagination run in SQL, not the browser. The `content_plans.posts` jsonb is backfilled into rows and dropped.
- **Row click opens a post summary page** with a full edit form.

## 2. Data model

Migration `supabase/migrations/0004_plan_posts.sql`:

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

`workspace_id`/`brand_id` are denormalized onto posts so RLS and brand filtering don't need joins. `position` preserves the AI's original ordering within a plan. `content_plans` keeps `title/platform/goal/period_start/post_count/generation_id` (plan metadata; `post_count` stays as written at generation time).

### Statuses

| Value | Label | Badge tone |
|---|---|---|
| `qoralama` | Qoralama | neutral (muted) |
| `jarayonda` | Jarayonda | info (blue) |
| `tayyor` | Tayyor | warn (amber) |
| `elon_qilingan` | E‘lon qilingan | success (green accent) |

Badge tones become semantic tokens in `globals.css` (`@theme` — e.g. `--color-info`, `--color-warn`, soft background variants), light and dark values; components never use raw palette colors. New AI-generated posts default to `qoralama`.

## 3. Phase-3 code migration (jsonb → rows)

- **Generate route** (`api/generate/content-plan`): after inserting the plan row (no `posts` field), bulk-insert `plan_posts` rows from the AI output with `position` = array index + 1, default status. If the posts insert fails, delete the just-created plan row and return the standard error (credits already spent — same acceptance as phase 3).
- **Plan detail page** (`/app/plan/[id]`): loads `plan_posts` by `plan_id` ordered by `position`; keeps its inline row editing but the server action updates by **post id** (`updatePlanPost(postId, fields)` — the index-based `mergePlanPost` helper and its tests are deleted). Adds a read-only status badge column; row "Tahrirlash" stays inline, and each row also links to the post summary page.
- **Export route**: reads `plan_posts` ordered by `position`; both formats gain a "Holat" column (label text).
- Types: `PlanPost` (Zod, AI output shape) stays; new `PlanPostRow` DB type in `src/lib/types.ts`. `ContentPlan` type drops `posts`.

## 4. Dashboard page (`/app/plan`)

Server component; **all view state lives in the URL**: `?q=&brand=&status=&format=&platform=&sort=&dir=&page=`. A pure, tested helper `parseTableParams(searchParams)` validates every param (unknown values → defaults; never errors). The page runs one Supabase query: `plan_posts` joined to `content_plans!inner (title, platform)` and `brands (name)`, with:

- **Search** `q`: `topic.ilike.%q%` OR `hook.ilike.%q%`
- **Filters:** `brand_id` eq, `status` eq, `format` eq, plan `platform` eq (on the joined table)
- **Sort:** `date` (default, desc) or `topic`; `dir` asc|desc
- **Pagination:** `.range()` 25 per page, with exact count for "1–25 / N"

Layout:

- **Header:** H1 "Kontent-plan" + "Yangi plan" button (unchanged).
- **Toolbar** (client, wraps on mobile): debounced (300 ms) search input with icon; selects for Brend, Holat, Format, Platforma (each with a "Barchasi" all-option); when any filter/search is active, a "Tozalash" button clears them. Toolbar writes state to the URL via `router.replace`; a `useTransition` pending state dims the table while the server re-renders.
- **Table columns:** checkbox · Sana (sortable) · Mavzu (primary, truncated with hook as a second muted line) · Format badge · Holat status badge · Brend · Plan title (links to `/app/plan/[id]`). Rows are clickable → post summary page (`/app/plan/post/[id]`); the checkbox and Plan link stop propagation. Sortable headers toggle asc/desc with an arrow indicator (URL links).
- **Bulk selection:** header checkbox selects the visible page; with ≥1 selected, a contextual bar replaces/overlays the toolbar area: "N ta tanlandi", status select + "Qo‘llash" (server action `bulkUpdateStatus(ids, status)` — single `UPDATE ... WHERE id IN`, RLS-scoped), and a clear-selection ✕. Selection resets on page/filter change.
- **Pagination footer:** "1–25 / 312" + Oldingi/Keyingi buttons (URL links, disabled at bounds).
- **Empty states:** workspace has no posts → card with CTA to create the first plan (as today); filters/search match nothing → "Hech narsa topilmadi" + "Filtrlarni tozalash".
- **Responsive:** toolbar controls wrap; below `md` the Brend and Plan columns hide and the table scrolls horizontally.

## 5. Post summary page (`/app/plan/post/[id]`)

Server page loading the post + plan title + brand name. Shows context (Brend · Plan link · Sana) and an edit form: Mavzu, Format (select), Hook, CTA, Maqsad (textareas), Holat (select) + Saqlash. Submits to the same `updatePlanPost(postId, fields)` action; success returns to the referring view via "← Orqaga" link (to `/app/plan`) and a saved confirmation. Date is not editable (unchanged from phase 3 scope).

## 6. Components

```
src/app/app/plan/page.tsx            — server: parseTableParams → query → render
src/app/app/plan/PostsToolbar.tsx    — client: search + filter selects + URL state
src/app/app/plan/PostsTable.tsx      — client: rows, selection, bulk bar, sortable headers
src/app/app/plan/post/[id]/page.tsx  — server: post summary
src/app/app/plan/post/[id]/PostForm.tsx — client: edit form
src/app/app/plan/actions.ts          — updatePlanPost(postId, fields), bulkUpdateStatus(ids, status)
src/lib/planTable.ts                 — parseTableParams + types (pure, tested)
src/lib/plans.ts                     — PLAN_STATUSES/labels (mergePlanPost removed)
src/components/ui/StatusBadge.tsx    — status → label + tone classes
```

## 7. Testing

TDD (vitest) on pure logic: `parseTableParams` (defaults, clamping page ≥ 1, rejecting unknown enum values, sort whitelist), `PLAN_STATUSES` shape/labels, export serializer's Holat column, zod validation for `bulkUpdateStatus` input. Everything visual/query verified end-to-end in the browser (generate → filter/search/sort/paginate → bulk status → post page edit → export).

## 8. Error handling

- Bad/hostile query params never 500 — `parseTableParams` falls back to defaults.
- Server actions return `{ ok: false, error }` with Uzbek messages; RLS makes foreign post ids in bulk requests no-ops.
- Post summary page 404s (`notFound()`) for missing/foreign ids.

## 9. Out of scope

Bulk delete, saved views, column visibility/resize controls, drag-to-reschedule, calendar view, per-post AI regeneration, date editing, plan-level table view.
