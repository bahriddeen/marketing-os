# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev             # start dev server (Turbopack) at localhost:3000
npm run build            # production build
npm run lint              # eslint (flat config, next/core-web-vitals + next/typescript)
npm test                    # vitest run — all tests
npx vitest run src/lib/ai/engine.test.ts   # single test file
npx vitest run -t "includes all brand fields"  # single test by name
npx tsc --noEmit          # typecheck only (not wired into a script, but standard gate)
```

Tests live next to the code they test (`src/lib/ai/engine.test.ts`), included via `src/**/*.test.ts` in `vitest.config.ts`. There is no `passWithNoTests: false` gate — an empty test run is a pass.

### Environment

Copy `.env.example` to `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`. Schema lives in `supabase/migrations/*.sql` — apply new migrations by running them in the Supabase SQL editor (no CLI migration runner is wired up). In Supabase Authentication → Providers → Email, disable "Confirm email" (MVP).

## Architecture

**Product:** AI Marketing OS — Uzbek-market SaaS that generates marketing content (copy, content plans, reels scripts) from a persistent per-brand knowledge base, so the user never re-explains their company. Solo-founder MVP; see `docs/superpowers/specs/` and `docs/superpowers/plans/` for the original TZ, the MVP build plan, and subsequent feature specs/plans (each feature gets a dated `<topic>-design.md` spec and a matching `<topic>.md` implementation plan).

**Stack:** Next.js 16 App Router + TypeScript, Supabase (Postgres + RLS + Auth via `@supabase/ssr`), Anthropic API (`claude-opus-4-8`) via a shared generation engine, Tailwind CSS v4 (CSS-first config, no `tailwind.config.*` — theme tokens live in `src/app/globals.css`'s `@theme inline` block), Zod for structured AI output and input validation, `exceljs` for xlsx export.

### Auth, workspaces, and multi-tenancy

- `src/middleware.ts` refreshes the Supabase session cookie on every request and redirects unauthenticated visitors away from `/app/*` to `/login` (matcher: `/app/:path*`, `/login`, `/signup`).
- `getOrCreateWorkspace()` in `src/lib/workspace.ts` is the entry point every `/app/*` page/layout calls. It's wrapped in React's `cache()` so parallel layout+page rendering share one call instead of racing to create duplicate workspaces on first login — this specifically fixed a real bug (see `supabase/migrations/0002_bootstrap_race_fix.sql`). If you lose a concurrent-insert race (unique index on `workspace_members.user_id`), it deletes its own just-created workspace and re-reads the winner's — don't remove that fallback path.
- **One workspace per user is a DB-enforced MVP invariant** (`workspace_members_one_per_user` unique index). Multi-workspace/team-seat support means dropping that index, not just changing app code.
- All tenant tables (`brands`, `generations`, `content_plans`, `plan_posts`, `chat_conversations`, `chat_messages`, `credit_ledger`) are workspace-scoped via RLS policies built on `is_member(workspace_id)`, a `security definer` SQL function (avoids RLS self-recursion). New tables that hold tenant data need the same `is_member()`-based policy, not ad hoc `workspace_id = ...` checks.

### AI generation engine (`src/lib/ai/`)

`runStructuredGeneration()` in `engine.ts` is the single choke point every generation module calls — it checks the credit balance, calls Anthropic with a Zod output schema, persists the result to `generations`, and debits `credit_ledger`. It returns `generationId` so callers can link derived rows (e.g. a saved plan) back to the audit log. To add a new generation module (reels, chat, …):

1. Add the module id + credit weight to `credits.ts` (`ModuleId`, `CREDIT_WEIGHTS`).
2. Add its output shape to `schemas.ts` (a `z.object(...)`).
3. Add a `modules/<name>.ts` with format/style enums and an instructions-builder function, following `modules/copy.ts` or `modules/contentPlan.ts`.
4. Add an API route under `src/app/api/generate/<name>/route.ts` that validates input, loads the brand, calls `runStructuredGeneration`, and (if the output needs its own queryable rows, like content plans) persists derived rows in a follow-up insert — follow `api/generate/copy/route.ts` (simple) or `api/generate/content-plan/route.ts` (derived-rows pattern, including deleting the parent row if the child insert fails).

Prompt structure is two cached system blocks (`cache_control: { type: "ephemeral" }`): a stable `SYSTEM_BASE` (persona + Uzbek-only instruction) and a per-request block of `buildBrandContext(brand) + moduleInstructions`. This is what makes repeated generations for the same brand cheap — don't collapse these into one uncached block or inline the brand context into the user message.

Credits are a ledger, not a counter: balance is always `sum(credit_ledger.delta)` for the workspace (see `getCreditBalance`). New credit grants/spends are ledger inserts with a `reason` (`generation` | `plan_grant` | `admin_adjust`), never a direct balance update.

### Chat module and streaming (`/app/chat`, `src/lib/chatStream.ts`)

Chat is the one generation module that streams: `runStreamingChatGeneration()` in `engine.ts` is a separate async-generator entry point alongside `runStructuredGeneration()` (it doesn't go through the Zod structured-output path while streaming — the yielded text is validated against `ChatResponseSchema` only after the stream completes, in the route handler). `POST /api/chat/[conversationId]/send` drives the generator, forwards each chunk to the client as a hand-rolled SSE frame (`formatSSEFrame`/`parseSSEFrames` in `chatStream.ts` — not the `EventSource` API, since this is a POST with a body), and only calls `persistGenerationAndDebit` (crediting/logging) after the full response is collected. The user's message is persisted to `chat_messages` *before* the credit check/generation call, so a failed generation never loses the user's input; the assistant's reply is persisted after the stream completes but the reply is still sent to the client even if that insert fails (a paid-for response is never discarded). `ChatInput.tsx` reads the stream manually via `response.body.getReader()` and feeds parsed frames to callbacks (`onDelta`, `onDone`, `onStreamError`) rather than local state, so the parent page owns the message list. A conversation whose brand has been deleted is read-only (`isReadOnly` prop) — history stays visible but sending is blocked both client-side and by a 410 from the route.

### Billing and activation codes (`/app/admin`, `src/lib/billing.ts`)

MVP billing is manual/offline, not a payment gateway: `src/lib/billing.ts` defines the plans (`starter`/`professional`/`agency`), their credit grants, and a placeholder per-credit UZS rate and contact phone number for manual top-up requests. Admins generate one-time activation codes (`admin_generate_code` Postgres RPC, `0005_billing_activation.sql`) for a subscription plan or a raw credit top-up; a user redeems a code to grant credits via `credit_ledger`. All admin actions (`generateCode`/`voidCode`/`addCredit` in `src/app/app/admin/actions.ts`) are thin wrappers around `security definer` RPCs (`admin_generate_code`, `admin_void_code`, `admin_add_credit`) that self-check `is_admin()` server-side — the Next.js layer does no authorization of its own, so don't add admin gating in the route/action instead of the RPC.

### Content plans (`/app/plan`)

A content plan (`content_plans` row) is generated metadata (title, brand, platform, goal, period, post count); its individual posts live as normalized rows in `plan_posts` (one row per post: date, topic, format, hook, CTA, goal, `status`), not as jsonb on the plan — this table was split out of an original `posts jsonb` column via `0004_plan_posts.sql`, and any new plan-related feature should read/write `plan_posts` directly rather than reintroducing a jsonb blob. `PLAN_STATUS_VALUES`/`PLAN_STATUS_LABELS` in `src/lib/plans.ts` define the post lifecycle (`qoralama` → `jarayonda` → `tayyor` → `elon_qilingan`); `StatusBadge` renders it.

`/app/plan` itself lists **plans** (one row per generated plan, with delete), not posts — this was a deliberate redesign (see `docs/superpowers/specs/2026-07-13-plans-list-redesign-design.md`) away from an earlier posts-first dashboard iteration; don't reintroduce post-level search/filter/bulk-status at this route without checking that spec's rationale first. `/app/plan/[id]` shows one plan's posts (inline-editable table); `/app/plan/post/[id]` is a single post's full edit page. Exports (`/api/plans/[id]/export`) read from `plan_posts` and produce xlsx/CSV with a UTF-8 BOM for Excel compatibility with Uzbek characters — see `src/lib/planExport.ts`.

URL-driven list state (search/filter/sort/pagination) follows a fixed pattern used by both `plansTable.ts` helpers and their consuming page: a pure `parse*Params(searchParams)` function that never throws (hostile/missing values fall back to safe defaults) and a paired `build*Query(params, overrides)` that serializes only non-default fields back into a query string. Follow this pattern for any new filterable list rather than parsing `searchParams` ad hoc in the page component.

### Frontend

- Design tokens (colors, fonts, dark mode via `prefers-color-scheme`) are CSS custom properties in `src/app/globals.css`, re-exposed to Tailwind through `@theme inline`. Components use semantic utilities (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, `bg-accent-soft`, `border-line`, `text-danger`, `text-info`/`bg-info-soft`, `text-warn`/`bg-warn-soft`, etc.) — never raw Tailwind palette colors (`bg-gray-500`, `text-red-600`) or hardcoded hex. When adding a new semantic color, define it in all of light `:root`, the dark `@media (prefers-color-scheme: dark)` block, the `[data-theme]`-pinned light/dark override blocks, and the `@theme inline` mapping — missing one silently breaks that variant.
- Shared UI primitives live in `src/components/ui/` (`Button`, `Input`/`Textarea`/`Select`/`Label`, `Card`, `StatusBadge`) — restyle/extend pages through these rather than one-off `<input>`/`<button>` markup.
- `src/components/marketing/CaptionDemo.tsx` is the product's signature visual element (a live-typing demo of a generated caption), reused on the landing hero and the auth split-screen panel (`src/components/auth/AuthSplitLayout.tsx`). It respects `prefers-reduced-motion` — don't add motion that bypasses that check.
- The sidebar (`src/components/app/Sidebar.tsx`) is a client component (`usePathname` for active-route state) rendered from the otherwise-server `src/app/app/layout.tsx`; it collapses to an icon-only top bar below `md:`, not a hidden drawer.
- Next.js 16: dynamic route `params` and page-level `searchParams` are **Promises** — always `await` them (`const { id } = await params;`).

### Language constraint

All UI copy and AI-generated content must be Uzbek (Latin script) only — see `SYSTEM_BASE` in `src/lib/ai/prompts.ts` and every existing page/component. No Russian, no English strings, with the single exception of the product name "AI Marketing OS". This has caused recurring bugs worth watching for specifically: bare "AI" used as a common noun instead of "sun'iy intellekt", the wrong Unicode apostrophe (U+2019 instead of this codebase's U+2018 for the tutuq belgisi — grep for `’` when reviewing generated Uzbek strings), and HTML entities (`&#39;`/`&apos;`) that only decode inside literal JSX text — not inside JS string literals/variables interpolated via `{expr}`.
