# Billing & Activation Workflow — Design

**Date:** 2026-07-14
**Status:** Approved
**Phase:** MVP Build Roadmap Phase 6 (Credits & plans), sub-project 1 of 2

## Context

Phase 6 of the original build roadmap (`docs/superpowers/specs/2026-07-11-ai-marketing-os-design.md`, section 11) bundles four things: credit ledger (already built — see `src/lib/ai/engine.ts`, `src/lib/workspace.ts`), plan limits, trial expiry, and an admin activation panel. This spec covers the **billing & activation workflow** only — the mechanism by which a workspace's plan and credit balance actually change. Trial expiry and plan/brand-count limits are a separate, later sub-project that will read the state this one produces (`workspaces.plan`, `workspaces.plan_expires_at`).

The product targets the Uzbek market. International gateways (Stripe, etc.) don't fit: Uzbekistan isn't a supported Stripe country, and most local customers carry Humo/Uzcard rather than Visa/Mastercard. The original design doc already anticipated this — MVP payment is a manual transfer + admin confirmation, with merchant API automation deferred to v1.1. This spec goes further than "admin looks up a workspace": it uses a **redemption code** system so payment coordination happens entirely off-platform (phone call) and the in-app surface is just "generate a code" (admin) / "enter a code" (user).

## Goals

- User can see plan tiers and one-time top-up pricing, and knows how to reach the admin to pay.
- Admin (solo founder) can, after confirming a manual payment by phone, generate a single-use code that grants either a subscription (plan + monthly credit allotment + 30-day expiry) or a flat credit top-up.
- User redeems that code in-app to apply the grant.
- Admin can also add credit directly to a workspace without a code, for edge cases (goodwill credit, corrections).
- Admin identity is a hardcoded allowlist — no new user-facing role/permission system.

## Non-goals

- No automated payment gateway integration (Payme/Click merchant API) — explicitly deferred to v1.1 per the original spec.
- No enforcement of trial expiry or brand-count limits — that's sub-project 2.
- No multi-admin roles, audit UI beyond the codes list, or code expiration windows.

## Data model

### `workspaces.owner_email` (new column)

`text`, populated from the authenticated user's email inside `getOrCreateWorkspace()` at workspace-creation time (`src/lib/workspace.ts`). Existing rows get backfilled via a one-off `update` in the migration, joining `workspace_members` (role = `owner`) to `auth.users`.

Rationale: lets the admin panel search/list workspaces by owner without a Supabase service-role key or `auth.admin` API calls — everything stays within the existing anon-key + RLS model.

### `redemption_codes` (new table)

```sql
create table redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('subscription','topup')),
  plan text check (plan in ('starter','professional','agency')),
  credits int not null check (credits > 0),
  status text not null default 'active' check (status in ('active','redeemed','void')),
  redeemed_by_workspace_id uuid references workspaces(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
```

- `type = 'subscription'` requires `plan` set; `type = 'topup'` requires `plan` null (enforced in the generate function, not a DB constraint, to keep the check simple).
- Codes are **not** bound to a workspace at creation — whichever workspace redeems it first gets the grant. This matches the off-platform phone-call flow: the admin doesn't need to know the workspace ID, just relay the code string.

### `credit_ledger.reason` — extend check constraint

Add `'code_redeem'` to the existing `check (reason in ('generation','plan_grant','admin_adjust'))`. Code redemptions (both subscription and top-up) use this new reason; direct admin grants keep using `'admin_adjust'`.

### `is_admin()` — new security-definer function

```sql
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select auth.jwt() ->> 'email' = any(array['bahriddin.me@gmail.com'])
$$;
```

Single source of truth for admin identity — both RLS policies and the Next.js admin layout call this (via `supabase.rpc('is_admin')`) rather than maintaining a parallel `ADMIN_EMAILS` env var.

### RPC functions (security-definer, atomic)

- **`redeem_code(p_code text, p_workspace_id uuid) returns jsonb`** — callable by any authenticated user who is a member of `p_workspace_id` (checked via `is_member()` inside the function). Locks the code row with `select ... for update`, verifies `status = 'active'`, applies the effect:
  - `subscription`: `update workspaces set plan = code.plan, plan_expires_at = now() + interval '30 days' where id = p_workspace_id`; insert `credit_ledger` row `delta = code.credits, reason = 'code_redeem'`.
  - `topup`: insert `credit_ledger` row `delta = code.credits, reason = 'code_redeem'` only — no plan/expiry change.
  - Marks the code `status = 'redeemed'`, `redeemed_by_workspace_id`, `redeemed_at = now()`.
  - Returns `{ok: false, error: '...'}` for not-found/already-redeemed/void, so the API route can surface an Uzbek message without throwing.
- **`admin_generate_code(p_type text, p_plan text, p_credits int) returns redemption_codes`** — raises an exception if `not is_admin()`. Generates a random code string, inserts, returns the row.
- **`admin_void_code(p_code_id uuid) returns void`** — raises unless `is_admin()`; sets `status = 'void'` if currently `active` (no-op error if already redeemed/void).
- **`admin_add_credit(p_workspace_id uuid, p_amount int, p_note text) returns void`** — raises unless `is_admin()`; inserts `credit_ledger` row `delta = p_amount, reason = 'admin_adjust'`.

### RLS changes

- `redemption_codes`: enable RLS; `select`/`insert`/`update` policies all `using (is_admin())` / `with check (is_admin())`. Regular users never query this table directly — only through `redeem_code()`, which is `security definer` and bypasses RLS internally.
- `workspaces`: add a `select` policy `using (is_admin())` so the admin panel's workspace directory can list all workspaces (existing policy only allows `owner_id = auth.uid() or is_member(id)`).

## Constants (`src/lib/billing.ts`, new file)

```ts
export const PLAN_CREDITS: Record<'starter'|'professional'|'agency', number> = {
  starter: 300,
  professional: 1000,
  agency: 3000,
};
export const PLAN_PRICES_USD = { starter: 29, professional: 79, agency: 149 };
export const PRICE_PER_CREDIT_UZS = 1000; // placeholder — tune after launch
export const ADMIN_CONTACT_PHONE = "+998 90 000 00 00"; // placeholder — replace with real number before launch
```

## User-facing: `/app/upgrade`

New sidebar entry + page, server component fetching current workspace plan/balance, client sub-components for the interactive bits:

1. **Plan cards** — Starter/Professional/Agency, showing price (USD, informational), credits/mo, brand limit. No buy button — this is informational, driving the user to call.
2. **Top-up calculator** — number input (credits) → live `credits × PRICE_PER_CREDIT_UZS` display, formatted as so'm.
3. **Contact block** — static text with `ADMIN_CONTACT_PHONE`, instructing the user to call/message to arrange payment for either a plan or a top-up amount.
4. **Redeem code form** — text input + submit → `POST /api/redeem { code }`. On success, shows the new plan/balance and a success toast; on failure, an inline Uzbek error ("Kod noto'g'ri", "Bu kod allaqachon ishlatilgan", "Bu kod bekor qilingan").

## Admin: `/app/admin`

Route group gated in its layout: `await supabase.rpc('is_admin')`; redirect to `/app` if false (mirrors the existing `getOrCreateWorkspace` redirect-to-`/login` pattern). Not linked from the regular sidebar — direct-URL only, consistent with "no new role system" scope.

Sections on one page (small enough to not need sub-routes):

1. **Generate subscription code** — plan `<Select>` (starter/professional/agency); credits auto-displayed (read-only, from `PLAN_CREDITS`) once a plan is picked. Submit → `admin_generate_code('subscription', plan, credits)` → shows the generated code prominently (large monospace, copy button) for the admin to read over the phone.
2. **Generate top-up code** — credits `<Input type="number">`. Submit → `admin_generate_code('topup', null, credits)` → same code-display treatment.
3. **Codes list** — table of all codes (newest first): code, type, plan/credits, status, redeemed-by (workspace owner_email if redeemed), created_at. "Void" button on `active` rows → `admin_void_code`.
4. **Workspace directory** — searchable (by `owner_email`) table: owner_email, current plan, credit balance. Each row has an inline "add credits" action (amount input + submit) → `admin_add_credit`.

## API routes

- `POST /api/redeem` — body `{ code: string }`; loads the current workspace via `getOrCreateWorkspace()`, calls `redeem_code` RPC, returns `{ ok, plan?, creditsGranted?, error? }`.
- `POST /api/admin/codes` — body `{ type, plan?, credits }`; calls `admin_generate_code`. Route itself doesn't need to re-check admin (the RPC enforces it), but returns a friendly 403 message if the RPC raises.
- `DELETE /api/admin/codes/[id]` — calls `admin_void_code`.
- `POST /api/admin/credit` — body `{ workspaceId, amount, note }`; calls `admin_add_credit`.
- `GET /api/admin/workspaces?q=` — used by the workspace directory search; simple `select` filtered by `owner_email ilike`.

## Error handling

- All errors surfaced to the end user are in Uzbek (per the project's language constraint).
- Race safety: `redeem_code`'s `select ... for update` on the code row ensures two concurrent redemption attempts can't both succeed — the second sees `status != 'active'` after the first commits.
- Admin routes: since `is_admin()` is enforced inside the security-definer functions themselves, even a direct API call from a non-admin session fails at the DB layer, not just the route layer (defense in depth without needing a service-role key).

## Testing

No DB-integration test harness exists in this repo today (confirmed: all existing `*.test.ts` files test pure logic/helpers, not live Supabase calls). Given that, this feature's automated tests are scoped to pure logic:

- `src/lib/billing.test.ts` — `PLAN_CREDITS` lookup correctness, top-up price calculation.
- API route input validation (bad `type`, non-positive `credits`, missing `code`) following the existing route-test-light pattern used elsewhere in this codebase (most routes aren't unit-tested directly; validation is manual-checklist, consistent with `2026-07-13-reels-generator.md`'s approach).

The RPC/RLS behavior (atomicity, admin gating, redemption effects) is verified via a manual checklist in the implementation plan: generate a subscription code as admin, redeem it as a non-admin user, confirm plan/expiry/ledger changes, confirm a second redemption attempt fails, confirm a non-admin call to `admin_generate_code` is rejected.
