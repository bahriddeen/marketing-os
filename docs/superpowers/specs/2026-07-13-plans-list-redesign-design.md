# Plans List Redesign (wireframe) — Design

**Date:** 2026-07-13
**Status:** Approved
**Supersedes:** the posts-first dashboard at `/app/plan` (built earlier today, `2026-07-13-content-dashboard-design.md` §4). The `plan_posts` data model, plan detail page, post summary page, exports, and statuses from that spec all stay.
**Source:** user wireframe `~/Downloads/shapes at 26-07-13 06.06.59.png`.

## 1. Summary

`/app/plan` becomes a **plans table**: one row per generated plan. Clicking a row opens the plan's page (`/app/plan/[id]`), which shows the posts belonging to it. Top of page: a full-width title-search bar with a sliders-icon button that toggles a filter panel. Each row has Tahrirlash (pencil) and O‘chirish (trash) action icons — plan deletion is new. Pagination is numbered with a page-size selector.

Decisions from brainstorming:

- Rows = plans ("each generated data is one data"); posts live on the plan page.
- Row icons: pencil (opens the plan page) + trash (delete with inline confirm). **No checkboxes** — bulk status change is dropped from the top level (post statuses remain editable on the post page; a bulk bar on the plan detail page is a possible follow-up, out of scope here).
- Plan rows show a **post-count summary** ("N ta post"), not a status badge.
- Numbered pagination (‹ 1 2 3 … N ›) + "Natijalar: from–to / total" + page-size select 10/25/50, default 10.

## 2. Page layout (`/app/plan`)

Server component; view state in the URL: `?q=&brand=&platform=&page=&size=`. A pure helper parses/validates params (never throws; unknown values → defaults) and builds query strings, plus a tested `pageItems(current, last)` helper returning the numbered-page list with ellipsis markers (pattern: first, current±1, last; e.g. `[1, 2, 3, "…", 10]`).

- **Header:** H1 "Kontent-plan" + "Yangi plan" button (unchanged).
- **Search row:** full-width `Input` (placeholder "Plan nomi bo‘yicha qidirish…", debounced 300 ms, ilike on `content_plans.title`, same focus-safe local-state pattern and `[,()]` sanitization as before) with a `SlidersHorizontal` icon `Button` at its right end. The button toggles a filter panel (client state, closed by default; **open by default when a filter is active in the URL**) and shows an active-filter count badge.
- **Filter panel** (when open): Brend select, Platforma select, and "Tozalash" when anything is active. Changing a filter resets `page` to 1.
- **Table columns:** Plan (title, `period_start` month as muted subtitle) · Brend · Postlar ("N ta post", `post_count`) · actions (pencil `Link` to `/app/plan/[id]`, trash button). Whole row clickable → plan page; the actions cell stops propagation. Below `md`, the Brend column hides.
- **Delete flow:** trash click swaps the actions cell to inline confirm — "O‘chirilsinmi?" with "Ha" (danger) / "Yo‘q" buttons (no native dialogs). "Ha" calls `deletePlan(planId)`: deletes the `content_plans` row (RLS-scoped; `plan_posts` cascade), `revalidatePath("/app/plan", "layout")`, then `router.refresh()`. `generations` audit rows are untouched (their FK is on the plan side).
- **Pagination footer:** left — "Natijalar: {from}–{to} / {total}"; right — ‹ prev, numbered pages with ellipsis, next ›, current page highlighted (accent), plus a page-size `Select` (10/25/50; changing size resets to page 1).
- **Empty states:** no plans at all → existing CTA card; no matches → "Hech narsa topilmadi." + "Filtrlarni tozalash" (also clears the search box via the established render-time clear-only sync).
- **Sorting:** newest first (`created_at desc`), stable `id` tiebreak. No sortable headers in this iteration (not in the wireframe).

## 3. Query

One Supabase query: `content_plans` + `brands(name)` join, `count: "exact"`, filters `title ilike %q%`, `brand_id`, `platform`, ordered `created_at desc, id asc`, `.range()` by `page`/`size`.

## 4. Code changes

```
src/app/app/plan/page.tsx        — rewritten (plans query + layout above)
src/app/app/plan/PlansToolbar.tsx — new (search + filter panel + badge)
src/app/app/plan/PlansTable.tsx   — new (rows, actions, inline delete confirm)
src/app/app/plan/actions.ts       — add deletePlan(planId): Promise<{ok:true}|{ok:false;error:string}>
src/lib/plansTable.ts (+ test)    — parsePlansParams, buildPlansQuery, pageItems, PLAN_PAGE_SIZES
src/app/app/plan/PostsToolbar.tsx — deleted
src/app/app/plan/PostsTable.tsx   — deleted
src/lib/planTable.ts (+ test)     — deleted (superseded by plansTable.ts; post-status/format/platform filtering and buildTableQuery have no remaining consumers)
```

Untouched: plan detail page + `PlanTable` (inline post editing, exports), post summary page + `PostForm`, `updatePlanPost`, `plan_posts` schema, generate route, export routes, `StatusBadge` (still used by plan detail/post pages). `bulkUpdateStatus` action: **kept** (unused by UI for now, earmarked for the plan-detail follow-up) — remove only if lint complains about dead exports (it does not for exported server actions).

## 5. Testing

TDD on the pure helpers: `parsePlansParams` (defaults, hostile values, size whitelist 10/25/50), `pageItems` (short ranges without ellipsis, long ranges with leading/trailing ellipsis, edges at first/last page), `buildPlansQuery` (default omission, size only when ≠10). UI verified end-to-end in the browser (search, filter panel + badge, row click, pencil, delete confirm + cancel, delete, numbered pagination + size change, empty states).

## 6. Error handling

- `deletePlan` validates the id (uuid), returns Uzbek `{ ok:false, error }` on failure; RLS makes foreign ids no-ops (reported as "Plan topilmadi.").
- Bad query params → defaults, never 500 (same policy as before).

## 7. Out of scope

Bulk actions of any kind on the plans table, plan-level status, sortable headers, plan renaming/editing metadata (pencil only opens the plan page), moving bulk status change to the plan detail page (follow-up candidate).
