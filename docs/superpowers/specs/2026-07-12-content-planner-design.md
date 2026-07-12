# Content Planner (Phase 3) — Design

**Date:** 2026-07-12
**Status:** Approved
**Parent spec:** `2026-07-11-ai-marketing-os-design.md` §6.2, roadmap phase 3

## 1. Summary

The Content Planner generates a structured content plan (up to 30 posts) for a brand from its knowledge base: the user picks brand, platform, goal, month, and post count; the AI returns a table of posts (date, topic, format, hook, CTA, post goal). Plans are saved, re-openable, **editable per post**, and exportable as .xlsx and CSV.

Decisions made during brainstorming:

- **Scope:** view + export + edit individual posts. No per-post AI regeneration (future phase if wanted).
- **Generation UX:** non-streaming; reuse the existing `GeneratingCard` progress indicator, render the full table when done.
- **Storage:** one new `content_plans` table with posts as a jsonb array. `generations` stays a pure immutable audit log.

## 2. Data model

New migration `supabase/migrations/0003_content_plans.sql`:

```sql
create table content_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null,
  platform text not null check (platform in ('instagram','telegram','both')),
  goal text not null check (goal in ('awareness','engagement','sales')),
  period_start date not null,
  post_count int not null check (post_count between 1 and 30),
  posts jsonb not null,
  generation_id uuid references generations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_plans enable row level security;
create policy content_plans_all on content_plans for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
```

Each element of `posts` (and the `PlanPost` Zod/TS shape):

| Field | Type | Notes |
|---|---|---|
| `date` | string | ISO `YYYY-MM-DD`, within the chosen month |
| `topic` | string | Post topic (Uzbek) |
| `format` | enum | `post` \| `carousel` \| `reels` \| `story` |
| `hook` | string | Opening hook |
| `cta` | string | Call to action |
| `goal` | string | What this post is for (Uzbek free text) |

## 3. Generation flow

Follows the established module recipe (`CLAUDE.md` §AI generation engine). `content_plan` already exists in `ModuleId` with credit weight 10.

1. **`src/lib/ai/schemas.ts`** — add `PlanPostSchema` and `ContentPlanSchema` (`{ title: string, posts: PlanPost[] }`). The model proposes the plan title.
2. **`src/lib/ai/modules/contentPlan.ts`** — `PLAN_PLATFORMS`, `PLAN_GOALS` enums with Uzbek labels, and `contentPlanInstructions(platform, goal, postCount, periodStart)`; instructions tell the model to spread ISO dates across the month (respecting a sensible weekly rhythm), mix formats, and write everything in Uzbek (Latin).
3. **`src/app/api/generate/content-plan/route.ts`** — mirrors the copy route: validate input (platform/goal in enums, `1 ≤ postCount ≤ 30`, `periodStart` a valid date, brand loads via RLS), call `runStructuredGeneration` with `module: "content_plan"`, `maxTokens: 12000`, then insert the `content_plans` row and return `{ ok, planId, data, creditsLeft }`. `export const maxDuration = 300` — this generation runs 1–3 minutes.

**Engine change:** `runStructuredGeneration`'s success result gains `generationId: string | null` (the `generations` row id it already receives from its insert) so callers can link derived records to the audit log. Additive; existing callers unaffected.

## 4. UI

New sidebar entry **"Kontent-plan"** (`/app/plan`), icon consistent with existing sidebar items.

- **`/app/plan`** — server page listing the workspace's saved plans (title, brand name, period, post count, created date) as cards, newest first; "Yangi plan" button. Empty state invites creating the first plan.
- **`/app/plan/new`** — client form: brand select, platform select, goal select, month picker (`<input type="month">` styled via UI primitives), post count select. Submit calls the generate API, shows `GeneratingCard` while waiting, then `router.push` to the new plan.
- **`/app/plan/[id]`** — server page loading the plan; renders a client `PlanTable`:
  - Columns: Sana, Mavzu, Format, Hook, CTA, Maqsad.
  - **Per-post editing:** an edit control per row opens the row's text fields for inline editing; save calls a server action `updatePlanPost(planId, index, fields)` that merges the change into the jsonb `posts` array and bumps `updated_at`. Format edits via select of the four enum values; date is not editable in MVP.
  - Export buttons: "Excel (.xlsx)" and "CSV" linking to the export route.

All copy Uzbek (Latin) with U+2018 tutuq belgisi; semantic color utilities and `src/components/ui/` primitives only.

## 5. Export

`GET /api/plans/[id]/export?format=xlsx|csv` — loads the plan (RLS-scoped), returns a download named from the plan title (sanitized).

- **xlsx:** `exceljs` (new dependency, per parent spec §4): one worksheet, header row (Uzbek labels), one row per post, reasonable column widths.
- **CSV:** hand-rolled serializer (quote-escaping per RFC 4180) prefixed with a UTF-8 BOM so Excel renders Uzbek characters.

The serialization from `PlanPost[]` to row arrays is a pure shared function used by both formats.

## 6. Testing

TDD (vitest) on the pure logic:

- `contentPlanInstructions` — includes platform/goal/count/period, Uzbek labels.
- `ContentPlanSchema` — accepts a valid plan, rejects bad format enum / missing fields.
- CSV serializer — quoting, BOM, header row, one line per post.
- Post-edit merge — updating index N changes only that post, preserves others.

Route handlers and UI verified manually end-to-end (generate a plan for a real brand, edit a post, download both exports, confirm ledger −10 and `generations` row).

## 7. Error handling

- Credit shortfall and Anthropic errors surface via the engine's existing Uzbek `{ ok: false, error }` messages; the form shows the existing error banner pattern.
- Export route returns 404 for a missing/foreign plan (RLS makes it invisible).
- If the plan insert fails after a successful generation, the API returns an error but credits were already spent — acceptable at MVP; the generation output still exists in `generations`.

## 8. Out of scope

Per-post AI regeneration, per-post status tracking (draft/published), date editing, Google Sheets/Notion export, plan duplication, chat integration with saved plans (phase 5 concern).
