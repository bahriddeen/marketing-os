# Billing & Activation Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user redeem an admin-issued code to activate a subscription plan or add one-time credits, and let the admin (solo founder) generate/void those codes and directly grant credits — all coordinated by an off-platform phone call, per `docs/superpowers/specs/2026-07-14-billing-activation-design.md`.

**Architecture:** A new `redemption_codes` table plus four Postgres `security definer` functions (`redeem_code`, `admin_generate_code`, `admin_void_code`, `admin_add_credit`) do the atomic, race-safe state changes (row-locked via `for update`). A hardcoded-email `is_admin()` SQL function is the single source of truth for admin identity, checked by both RLS policies and a Next.js layout guard. The Next.js side is two new route groups — `/app/upgrade` (user-facing: plan info, top-up calculator, redeem form) and `/app/admin` (admin-only: generate/void codes, direct credit grants, workspace directory) — using **server actions** (`"use server"`, Zod-validated, `{ok, error}` return shape), matching this codebase's existing `src/app/app/plan/actions.ts` pattern rather than the `/api/generate/*` route-handler pattern (that pattern exists specifically for the AI generation engine's structured-output calls, which this feature doesn't use).

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase Postgres (RLS, `security definer` functions, `plpgsql`), Zod, Tailwind v4 semantic tokens, Vitest.

## Global Constraints

- All user-facing copy is Uzbek (Latin script), tutuq belgisi is U+2018 (`'`), never U+2019 or HTML entities in JS string literals.
- No raw Tailwind palette colors — use semantic tokens (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent-soft`, `text-danger`, etc.).
- Migrations are applied manually in the Supabase SQL editor (no CLI runner) — every migration step in this plan says exactly what to paste and run there.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` must all stay clean; run them after each task that touches TypeScript.
- `Workspace.owner_email`, `redemption_codes`, and the four SQL functions are all new — no existing code depends on their absence, so no back-compat shims are needed.

---

### Task 1: Database migration — redemption codes, admin role, atomic functions

**Files:**
- Create: `supabase/migrations/0005_billing_activation.sql`

**Interfaces:**
- Produces: table `redemption_codes` (columns: `id uuid`, `code text unique`, `type text`, `plan text`, `credits int`, `status text`, `redeemed_by_workspace_id uuid`, `redeemed_at timestamptz`, `created_at timestamptz`); `workspaces.owner_email text`; `credit_ledger.note text`; `credit_ledger.reason` check now includes `'code_redeem'`; SQL functions `is_admin() returns boolean`, `redeem_code(p_code text, p_workspace_id uuid) returns jsonb`, `admin_generate_code(p_type text, p_plan text, p_credits int) returns redemption_codes`, `admin_void_code(p_code_id uuid) returns boolean`, `admin_add_credit(p_workspace_id uuid, p_amount int, p_note text) returns void`.

- [ ] **Step 1: Find the existing `credit_ledger` reason check-constraint name**

Run in the Supabase SQL editor:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'credit_ledger'::regclass and contype = 'c';
```

Expected: one row, `conname` = `credit_ledger_reason_check` (Postgres's default auto-generated name for the first check constraint on that column, declared inline in `0001_init.sql`). If the actual name differs, substitute it in Step 2 below.

- [ ] **Step 2: Write the migration file**

```sql
-- Billing & activation workflow: redemption codes, admin identity, and the
-- atomic security-definer functions that apply their effects. See
-- docs/superpowers/specs/2026-07-14-billing-activation-design.md.

alter table workspaces add column owner_email text;

update workspaces w
set owner_email = u.email
from workspace_members wm
join auth.users u on u.id = wm.user_id
where wm.workspace_id = w.id and wm.role = 'owner' and w.owner_email is null;

alter table credit_ledger add column note text;

alter table credit_ledger drop constraint credit_ledger_reason_check;
alter table credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('generation','plan_grant','admin_adjust','code_redeem'));

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

alter table redemption_codes enable row level security;

-- Single source of truth for "who is admin". Both RLS below and the
-- Next.js /app/admin layout guard call this via supabase.rpc('is_admin')
-- rather than keeping a second allowlist in an env var.
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select auth.jwt() ->> 'email' = any(array['bahriddin.me@gmail.com'])
$$;

create policy redemption_codes_admin on redemption_codes for all
  using (is_admin()) with check (is_admin());

-- Existing ws_select policy only covers owner_id/is_member; this adds
-- admin visibility for the workspace directory in /app/admin.
create policy ws_admin_select on workspaces for select using (is_admin());

-- Callable by any member of p_workspace_id (not admin-only). Row-locks the
-- code so two concurrent redemptions of the same code can't both succeed.
create or replace function public.redeem_code(p_code text, p_workspace_id uuid)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_code redemption_codes%rowtype;
begin
  if not is_member(p_workspace_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_code from redemption_codes where code = p_code for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_code.status = 'redeemed' then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed');
  end if;
  if v_code.status = 'void' then
    return jsonb_build_object('ok', false, 'error', 'void');
  end if;

  if v_code.type = 'subscription' then
    update workspaces
    set plan = v_code.plan, plan_expires_at = now() + interval '30 days'
    where id = p_workspace_id;
  end if;

  insert into credit_ledger (workspace_id, delta, reason)
  values (p_workspace_id, v_code.credits, 'code_redeem');

  update redemption_codes
  set status = 'redeemed', redeemed_by_workspace_id = p_workspace_id, redeemed_at = now()
  where id = v_code.id;

  return jsonb_build_object(
    'ok', true, 'type', v_code.type, 'plan', v_code.plan, 'credits', v_code.credits
  );
end;
$$;

-- Admin-only. p_credits is passed in by the caller (looked up from the TS
-- PLAN_CREDITS map for subscription codes) rather than re-derived here, so
-- the plan->credits mapping has exactly one source of truth (src/lib/billing.ts).
create or replace function public.admin_generate_code(p_type text, p_plan text, p_credits int)
returns redemption_codes language plpgsql security definer
set search_path = public as $$
declare
  v_row redemption_codes%rowtype;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  if p_type not in ('subscription','topup') then
    raise exception 'invalid type';
  end if;
  if p_type = 'subscription' and p_plan is null then
    raise exception 'plan required for subscription codes';
  end if;
  if p_type = 'topup' and p_plan is not null then
    raise exception 'topup codes must not have a plan';
  end if;
  if p_credits is null or p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  insert into redemption_codes (code, type, plan, credits)
  values (
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
    p_type, p_plan, p_credits
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_void_code(p_code_id uuid)
returns boolean language plpgsql security definer
set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update redemption_codes set status = 'void' where id = p_code_id and status = 'active';
  return found;
end;
$$;

create or replace function public.admin_add_credit(p_workspace_id uuid, p_amount int, p_note text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount = 0 then
    raise exception 'amount must be non-zero';
  end if;
  insert into credit_ledger (workspace_id, delta, reason, note)
  values (p_workspace_id, p_amount, 'admin_adjust', p_note);
end;
$$;
```

- [ ] **Step 3: Run the migration in the Supabase SQL editor**

Paste the full script from Step 2 and run it. Expected: no errors, "Success. No rows returned" (the `update` may report rows affected, which is fine).

- [ ] **Step 4: Verify schema objects exist**

Run:

```sql
select column_name from information_schema.columns where table_name = 'workspaces' and column_name = 'owner_email';
select column_name from information_schema.columns where table_name = 'credit_ledger' and column_name = 'note';
select proname from pg_proc where proname in ('is_admin','redeem_code','admin_generate_code','admin_void_code','admin_add_credit');
select conname from pg_constraint where conrelid = 'credit_ledger'::regclass and contype = 'c';
```

Expected: `owner_email` and `note` each return one row; `pg_proc` returns all 5 function names; the constraint list includes `credit_ledger_reason_check`.

Note: functional testing of `redeem_code`/`admin_*` (their `is_admin()`/`is_member()` checks depend on `auth.jwt()`/`auth.uid()`, which only exist in an authenticated PostgREST/Supabase-client request — not in the SQL editor's superuser session) is deferred to Task 6's end-to-end checklist, once the app UI can drive them through a real session.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_billing_activation.sql
git commit -m "feat: add redemption codes schema and admin activation functions"
```

---

### Task 2: Billing constants and `owner_email` wiring

**Files:**
- Create: `src/lib/billing.ts`
- Test: `src/lib/billing.test.ts`
- Modify: `src/lib/types.ts` (add `owner_email` to `Workspace`)
- Modify: `src/lib/workspace.ts:32` (set `owner_email` on workspace creation)

**Interfaces:**
- Produces: `SubscriptionPlan` type, `PLAN_CREDITS: Record<SubscriptionPlan, number>`, `PLAN_PRICES_USD: Record<SubscriptionPlan, number>`, `PRICE_PER_CREDIT_UZS: number`, `ADMIN_CONTACT_PHONE: string`, `calculateTopupPriceUzs(credits: number): number` — all consumed by Tasks 3–5.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/billing.test.ts
import { describe, it, expect } from "vitest";
import {
  PLAN_CREDITS,
  PLAN_PRICES_USD,
  PRICE_PER_CREDIT_UZS,
  calculateTopupPriceUzs,
} from "./billing";

describe("billing constants", () => {
  it("has credits for every plan", () => {
    expect(PLAN_CREDITS.starter).toBe(300);
    expect(PLAN_CREDITS.professional).toBe(1000);
    expect(PLAN_CREDITS.agency).toBe(3000);
  });

  it("has a matching price entry for every credited plan", () => {
    expect(Object.keys(PLAN_PRICES_USD).sort()).toEqual(Object.keys(PLAN_CREDITS).sort());
  });
});

describe("calculateTopupPriceUzs", () => {
  it("multiplies credits by the flat per-credit rate", () => {
    expect(calculateTopupPriceUzs(10)).toBe(10 * PRICE_PER_CREDIT_UZS);
  });

  it("rounds fractional credit input to the nearest whole credit", () => {
    expect(calculateTopupPriceUzs(10.7)).toBe(11 * PRICE_PER_CREDIT_UZS);
  });

  it("floors negative input at zero", () => {
    expect(calculateTopupPriceUzs(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/billing.test.ts`
Expected: FAIL — `Cannot find module './billing'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/billing.ts
export type SubscriptionPlan = "starter" | "professional" | "agency";

export const PLAN_CREDITS: Record<SubscriptionPlan, number> = {
  starter: 300,
  professional: 1000,
  agency: 3000,
};

export const PLAN_PRICES_USD: Record<SubscriptionPlan, number> = {
  starter: 29,
  professional: 79,
  agency: 149,
};

// Placeholder rate — tune after launch.
export const PRICE_PER_CREDIT_UZS = 1000;

// Placeholder contact number — replace with the real one before launch.
export const ADMIN_CONTACT_PHONE = "+998 90 000 00 00";

export function calculateTopupPriceUzs(credits: number): number {
  return Math.max(0, Math.round(credits)) * PRICE_PER_CREDIT_UZS;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/billing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Update `Workspace` type**

In `src/lib/types.ts`, change:

```ts
export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  plan: "trial" | "starter" | "professional" | "agency";
  plan_expires_at: string | null;
};
```

to:

```ts
export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  plan: "trial" | "starter" | "professional" | "agency";
  plan_expires_at: string | null;
};
```

- [ ] **Step 6: Set `owner_email` at workspace creation**

In `src/lib/workspace.ts`, change:

```ts
  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({ name: "Mening jamoam", owner_id: user.id, plan: "trial" })
    .select()
    .single();
```

to:

```ts
  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({
      name: "Mening jamoam",
      owner_id: user.id,
      plan: "trial",
      owner_email: user.email ?? null,
    })
    .select()
    .single();
```

- [ ] **Step 7: Run full checks**

Run: `npx vitest run src/lib/billing.test.ts && npx tsc --noEmit`
Expected: both clean (tsc will now catch any other place constructing a `Workspace` literal missing `owner_email` — there are none today, since workspaces are only ever read from Supabase or built via this one insert).

- [ ] **Step 8: Commit**

```bash
git add src/lib/billing.ts src/lib/billing.test.ts src/lib/types.ts src/lib/workspace.ts
git commit -m "feat: add billing constants and workspace owner_email"
```

---

### Task 3: Redeem action and `/app/upgrade` page

**Files:**
- Create: `src/app/app/upgrade/actions.ts`
- Create: `src/app/app/upgrade/UpgradeForms.tsx`
- Create: `src/app/app/upgrade/page.tsx`
- Modify: `src/components/app/Sidebar.tsx` (add nav entry)

**Interfaces:**
- Consumes: `getOrCreateWorkspace()`, `getCreditBalance(workspaceId)` from `src/lib/workspace.ts`; `PLAN_CREDITS`, `PLAN_PRICES_USD`, `ADMIN_CONTACT_PHONE`, `calculateTopupPriceUzs`, `SubscriptionPlan` from `src/lib/billing.ts`.
- Produces: server action `redeemCode(code: string): Promise<{ok: true; type: "subscription"|"topup"; plan: string|null; credits: number} | {ok: false; error: string}>`; components `TopupCalculator` and `RedeemCodeForm` from `UpgradeForms.tsx`.

- [ ] **Step 1: Write the redeem action**

```ts
// src/app/app/upgrade/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";

const RedeemSchema = z.object({ code: z.string().trim().min(1) });

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "Kod noto‘g‘ri.",
  already_redeemed: "Bu kod allaqachon ishlatilgan.",
  void: "Bu kod bekor qilingan.",
  unauthorized: "Ruxsat yo‘q.",
};

export async function redeemCode(
  code: string
): Promise<
  | { ok: true; type: "subscription" | "topup"; plan: string | null; credits: number }
  | { ok: false; error: string }
> {
  const parsed = RedeemSchema.safeParse({ code });
  if (!parsed.success) {
    return { ok: false, error: "Kodni kiriting." };
  }

  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_code", {
    p_code: parsed.data.code.trim().toUpperCase(),
    p_workspace_id: ws.id,
  });

  if (error) {
    return { ok: false, error: "Xatolik yuz berdi. Qayta urinib ko‘ring." };
  }

  const result = data as {
    ok: boolean;
    error?: string;
    type?: string;
    plan?: string | null;
    credits?: number;
  };
  if (!result.ok) {
    return {
      ok: false,
      error: REDEEM_ERRORS[result.error ?? ""] ?? "Kodni tasdiqlab bo‘lmadi.",
    };
  }

  revalidatePath("/app/upgrade");
  return {
    ok: true,
    type: result.type as "subscription" | "topup",
    plan: result.plan ?? null,
    credits: result.credits ?? 0,
  };
}
```

Note on apostrophes: the tutuq belgisi character used throughout this codebase's Uzbek strings is U+2018 (visually `'`), matching e.g. `src/app/app/plan/actions.ts`'s `"Saqlab bo'lmadi. Qayta urinib ko'ring."`. Copy that exact character when typing the strings above rather than the standard ASCII apostrophe or U+2019.

- [ ] **Step 2: Write the client form components**

```tsx
// src/app/app/upgrade/UpgradeForms.tsx
"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { calculateTopupPriceUzs } from "@/lib/billing";
import { redeemCode } from "./actions";

function formatUzs(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(amount) + " so‘m";
}

export function TopupCalculator() {
  const [credits, setCredits] = useState(50);
  const price = calculateTopupPriceUzs(credits);
  return (
    <div className="space-y-3">
      <div>
        <Label>Nechta kredit kerak?</Label>
        <Input
          type="number"
          min={1}
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value) || 0)}
        />
      </div>
      <p className="text-sm text-muted">
        Narxi: <span className="font-medium text-ink">{formatUzs(price)}</span>
      </p>
    </div>
  );
}

export function RedeemCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await redeemCode(code);
      if (res.ok) {
        setError(null);
        setSuccess(
          res.type === "subscription"
            ? `Tarif faollashtirildi: ${res.plan}, +${res.credits} kredit.`
            : `+${res.credits} kredit qo‘shildi.`
        );
        setCode("");
        router.refresh();
      } else {
        setSuccess(null);
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Kodni kiriting</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="masalan: 3F9A0B21E4"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-accent">{success}</p>}
      <Button type="submit" disabled={pending || code.trim().length === 0}>
        {pending ? "Tekshirilmoqda…" : "Kodni faollashtirish"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/app/app/upgrade/page.tsx
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import Card from "@/components/ui/Card";
import {
  PLAN_CREDITS,
  PLAN_PRICES_USD,
  ADMIN_CONTACT_PHONE,
  type SubscriptionPlan,
} from "@/lib/billing";
import { TopupCalculator, RedeemCodeForm } from "./UpgradeForms";

const PLANS: SubscriptionPlan[] = ["starter", "professional", "agency"];

export default async function UpgradePage() {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Tarif va kreditlar</h1>
        <p className="text-muted">
          Joriy tarif: <span className="font-medium text-ink">{ws.plan}</span> · Balans:{" "}
          <span className="font-medium text-ink">{credits}</span> kredit
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p} className="space-y-2">
            <h2 className="font-display text-lg font-semibold capitalize text-ink">{p}</h2>
            <p className="text-2xl font-semibold text-ink">${PLAN_PRICES_USD[p]}/oy</p>
            <p className="text-sm text-muted">{PLAN_CREDITS[p]} kredit/oy</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          Bir martalik kredit sotib olish
        </h2>
        <TopupCalculator />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">To‘lov</h2>
        <p className="text-sm text-muted">
          Tarif yoki kredit sotib olish uchun {ADMIN_CONTACT_PHONE} raqamiga qo‘ng‘iroq qiling.
          To‘lovni tasdiqlagach, sizga faollashtirish kodi beriladi — uni pastdagi maydonga
          kiriting.
        </p>
        <RedeemCodeForm />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Add the sidebar entry**

In `src/components/app/Sidebar.tsx`, change the lucide import to include `CreditCard`:

```ts
import { Home, Briefcase, CalendarDays, PenLine, Clapperboard, CreditCard, LogOut } from "lucide-react";
```

and add an entry to `NAV` after the Reels entry:

```ts
const NAV = [
  { href: "/app", label: "Bosh sahifa", icon: Home, exact: true },
  { href: "/app/brands", label: "Brendlar", icon: Briefcase, exact: false },
  { href: "/app/plan", label: "Kontent-plan", icon: CalendarDays, exact: false },
  { href: "/app/copy", label: "Kopiraiting", icon: PenLine, exact: false },
  { href: "/app/reels", label: "Reels", icon: Clapperboard, exact: false },
  { href: "/app/upgrade", label: "Tarif", icon: CreditCard, exact: false },
];
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

Run `npm run dev`, log in, navigate to `/app/upgrade`. Expected: plan cards render, top-up calculator updates the price live as the credit input changes, the redeem form is present. (Redeeming an actual code isn't possible yet — Task 4 builds the admin side that generates one — full flow is verified in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add src/app/app/upgrade src/components/app/Sidebar.tsx
git commit -m "feat: add upgrade page with top-up calculator and code redemption"
```

---

### Task 4: Admin gating and code-generation actions

**Files:**
- Create: `src/app/app/admin/layout.tsx`
- Create: `src/app/app/admin/actions.ts`
- Create: `src/app/app/admin/GenerateCodeForm.tsx`

**Interfaces:**
- Consumes: `PLAN_CREDITS`, `SubscriptionPlan` from `src/lib/billing.ts`.
- Produces: server actions `generateCode(input: {type: "subscription"; plan: SubscriptionPlan} | {type: "topup"; credits: number}): Promise<{ok: true; code: string} | {ok: false; error: string}>` and `voidCode(codeId: string): Promise<{ok: true} | {ok: false; error: string}>`, both consumed by Task 5's `CodesList`.

- [ ] **Step 1: Write the admin layout guard**

```tsx
// src/app/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/app");
  return <div className="space-y-8">{children}</div>;
}
```

- [ ] **Step 2: Write the generate/void actions**

```ts
// src/app/app/admin/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLAN_CREDITS, type SubscriptionPlan } from "@/lib/billing";

const GenerateCodeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscription"), plan: z.enum(["starter", "professional", "agency"]) }),
  z.object({ type: z.literal("topup"), credits: z.number().int().positive() }),
]);

export async function generateCode(
  input: { type: "subscription"; plan: SubscriptionPlan } | { type: "topup"; credits: number }
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const parsed = GenerateCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const rpcParams =
    parsed.data.type === "subscription"
      ? {
          p_type: "subscription",
          p_plan: parsed.data.plan,
          p_credits: PLAN_CREDITS[parsed.data.plan],
        }
      : { p_type: "topup", p_plan: null, p_credits: parsed.data.credits };

  const { data, error } = await supabase.rpc("admin_generate_code", rpcParams);
  if (error || !data) {
    return { ok: false, error: "Kod yaratib bo‘lmadi. Admin huquqini tekshiring." };
  }

  revalidatePath("/app/admin");
  return { ok: true, code: (data as { code: string }).code };
}

const VoidCodeSchema = z.object({ codeId: z.string().uuid() });

export async function voidCode(codeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = VoidCodeSchema.safeParse({ codeId });
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri kod." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_void_code", { p_code_id: parsed.data.codeId });
  if (error || data !== true) {
    return { ok: false, error: "Kodni bekor qilib bo‘lmadi." };
  }

  revalidatePath("/app/admin");
  return { ok: true };
}
```

- [ ] **Step 3: Write the generate-code form**

```tsx
// src/app/app/admin/GenerateCodeForm.tsx
"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { PLAN_CREDITS, type SubscriptionPlan } from "@/lib/billing";
import { generateCode } from "./actions";

const PLANS: SubscriptionPlan[] = ["starter", "professional", "agency"];

export default function GenerateCodeForm() {
  const router = useRouter();
  const [type, setType] = useState<"subscription" | "topup">("subscription");
  const [plan, setPlan] = useState<SubscriptionPlan>("starter");
  const [credits, setCredits] = useState(50);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res =
        type === "subscription"
          ? await generateCode({ type: "subscription", plan })
          : await generateCode({ type: "topup", credits });
      if (res.ok) {
        setGenerated(res.code);
        setError(null);
        router.refresh();
      } else {
        setGenerated(null);
        setError(res.error);
      }
    });
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-ink">Kod yaratish</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              checked={type === "subscription"}
              onChange={() => setType("subscription")}
            />
            Obuna
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" checked={type === "topup"} onChange={() => setType("topup")} />
            Bir martalik kredit
          </label>
        </div>

        {type === "subscription" ? (
          <div>
            <Label>Tarif</Label>
            <Select value={plan} onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p} ({PLAN_CREDITS[p]} kredit)
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <Label>Kredit miqdori</Label>
            <Input
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value) || 0)}
            />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {generated && (
          <p className="rounded-[0.625rem] bg-accent-soft px-3 py-2.5 font-mono text-lg tracking-wide text-accent">
            {generated}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Yaratilmoqda…" : "Kod yaratish"}
        </Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. (`/app/admin` has no `page.tsx` yet — that's Task 5 — so it 404s for now; that's expected at this point in the plan.)

- [ ] **Step 5: Commit**

```bash
git add src/app/app/admin/layout.tsx src/app/app/admin/actions.ts src/app/app/admin/GenerateCodeForm.tsx
git commit -m "feat: add admin gating and code generation"
```

---

### Task 5: Direct credit grants, codes list, workspace directory, admin page

**Files:**
- Modify: `src/app/app/admin/actions.ts` (add `addCredit`)
- Create: `src/app/app/admin/CodesList.tsx`
- Create: `src/app/app/admin/WorkspaceDirectory.tsx`
- Create: `src/app/app/admin/page.tsx`

**Interfaces:**
- Consumes: `voidCode`, `generateCode` (Task 4); `GenerateCodeForm` (Task 4).
- Produces: server action `addCredit(workspaceId: string, amount: number, note: string): Promise<{ok:true}|{ok:false; error:string}>`; page renders all three admin sections.

- [ ] **Step 1: Add the `addCredit` action**

Append to `src/app/app/admin/actions.ts`:

```ts
const AddCreditSchema = z.object({
  workspaceId: z.string().uuid(),
  amount: z.number().int().refine((n) => n !== 0, "amount must be non-zero"),
  note: z.string().trim().optional(),
});

export async function addCredit(
  workspaceId: string,
  amount: number,
  note: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = AddCreditSchema.safeParse({ workspaceId, amount, note });
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_credit", {
    p_workspace_id: parsed.data.workspaceId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note || null,
  });
  if (error) {
    return { ok: false, error: "Kredit qo‘shib bo‘lmadi." };
  }

  revalidatePath("/app/admin");
  return { ok: true };
}
```

- [ ] **Step 2: Write the codes list**

```tsx
// src/app/app/admin/CodesList.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { voidCode } from "./actions";

export type CodeRow = {
  id: string;
  code: string;
  type: "subscription" | "topup";
  plan: string | null;
  credits: number;
  status: "active" | "redeemed" | "void";
  redeemed_by_email: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<CodeRow["status"], string> = {
  active: "Faol",
  redeemed: "Ishlatilgan",
  void: "Bekor qilingan",
};

export default function CodesList({ codes }: { codes: CodeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onVoid(id: string) {
    startTransition(async () => {
      await voidCode(id);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">Kodlar</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-muted">Kod</th>
              <th className="px-3 py-2 font-medium text-muted">Turi</th>
              <th className="px-3 py-2 font-medium text-muted">Kredit</th>
              <th className="px-3 py-2 font-medium text-muted">Holati</th>
              <th className="px-3 py-2 font-medium text-muted">Ishlatgan</th>
              <th className="w-32 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-mono">{c.code}</td>
                <td className="px-3 py-2">{c.type === "subscription" ? c.plan : "top-up"}</td>
                <td className="px-3 py-2">{c.credits}</td>
                <td className="px-3 py-2">{STATUS_LABELS[c.status]}</td>
                <td className="px-3 py-2">{c.redeemed_by_email ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.status === "active" && (
                    <Button variant="danger" disabled={pending} onClick={() => onVoid(c.id)}>
                      Bekor qilish
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Write the workspace directory**

```tsx
// src/app/app/admin/WorkspaceDirectory.tsx
"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { addCredit } from "./actions";

export type WorkspaceRow = {
  id: string;
  owner_email: string | null;
  plan: string;
  balance: number;
};

export default function WorkspaceDirectory({ workspaces }: { workspaces: WorkspaceRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => (w.owner_email ?? "").toLowerCase().includes(q));
  }, [query, workspaces]);

  function onAdd(workspaceId: string) {
    const amount = amounts[workspaceId] ?? 0;
    if (!amount) return;
    startTransition(async () => {
      await addCredit(workspaceId, amount, "admin panel");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">Ish maydonlari</h2>
      <Input
        placeholder="Email bo‘yicha qidirish"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-muted">Email</th>
              <th className="px-3 py-2 font-medium text-muted">Tarif</th>
              <th className="px-3 py-2 font-medium text-muted">Balans</th>
              <th className="w-48 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{w.owner_email ?? "—"}</td>
                <td className="px-3 py-2">{w.plan}</td>
                <td className="px-3 py-2 font-mono">{w.balance}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      value={amounts[w.id] ?? ""}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [w.id]: Number(e.target.value) || 0 }))
                      }
                    />
                    <Button variant="secondary" disabled={pending} onClick={() => onAdd(w.id)}>
                      Qo‘shish
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Write the admin page**

```tsx
// src/app/app/admin/page.tsx
import { createClient } from "@/lib/supabase/server";
import GenerateCodeForm from "./GenerateCodeForm";
import CodesList, { type CodeRow } from "./CodesList";
import WorkspaceDirectory, { type WorkspaceRow } from "./WorkspaceDirectory";

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: codes }, { data: workspaces }, { data: ledger }] = await Promise.all([
    supabase
      .from("redemption_codes")
      .select("id, code, type, plan, credits, status, created_at, workspaces(owner_email)")
      .order("created_at", { ascending: false }),
    supabase
      .from("workspaces")
      .select("id, owner_email, plan")
      .order("created_at", { ascending: false }),
    supabase.from("credit_ledger").select("workspace_id, delta"),
  ]);

  const balances = new Map<string, number>();
  for (const row of ledger ?? []) {
    balances.set(row.workspace_id, (balances.get(row.workspace_id) ?? 0) + row.delta);
  }

  const workspaceRows: WorkspaceRow[] = (workspaces ?? []).map((w) => ({
    id: w.id,
    owner_email: w.owner_email,
    plan: w.plan,
    balance: balances.get(w.id) ?? 0,
  }));

  // redeemed_by_workspace_id is a many-to-one FK (many codes -> one workspace),
  // so PostgREST embeds it as a single nested object (or null), not an array.
  const codeRows: CodeRow[] = (codes ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    plan: c.plan,
    credits: c.credits,
    status: c.status,
    created_at: c.created_at,
    redeemed_by_email: (c.workspaces as { owner_email: string | null } | null)?.owner_email ?? null,
  }));

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Admin</h1>
      <GenerateCodeForm />
      <CodesList codes={codeRows} />
      <WorkspaceDirectory workspaces={workspaceRows} />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

Run `npm run dev`, log in as the admin email set in `is_admin()`, navigate to `/app/admin`. Expected: page renders (not redirected); as a non-admin user, the same URL redirects to `/app`.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/admin
git commit -m "feat: add admin panel with codes list and workspace directory"
```

---

### Task 6: End-to-end verification and full gates

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated gate**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four clean.

- [ ] **Step 2: Verify subscription code redemption end-to-end**

As the admin (logged into `/app/admin` with the email configured in `is_admin()`):
1. Generate a subscription code for `professional`. Confirm the displayed code is a 10-character uppercase string and it appears in the codes list as `Faol` (active).

As a different, non-admin logged-in user (a second test account/workspace):
2. Go to `/app/upgrade`, enter that code in the redeem form. Expected: success message showing "Tarif faollashtirildi: professional, +1000 kredit."; the page's "Joriy tarif" / balance line updates after `router.refresh()`.
3. In Supabase, confirm: `workspaces.plan = 'professional'` and `plan_expires_at` ≈ now + 30 days for that workspace; `credit_ledger` has a new `+1000` row with `reason = 'code_redeem'` for that workspace.

- [ ] **Step 3: Verify redemption is single-use and race-safe**

4. Back on `/app/upgrade` (same non-admin user or a third workspace), submit the *same* code again. Expected: error "Bu kod allaqachon ishlatilgan."; back in `/app/admin`, the code now shows status `Ishlatilgan` (redeemed).

- [ ] **Step 4: Verify top-up code redemption**

5. As admin, generate a top-up code for 25 credits. Redeem it as a user. Expected: success message "+25 kredit qo‘shildi."; `workspaces.plan` is unchanged; `credit_ledger` has a `+25` row with `reason = 'code_redeem'`.

- [ ] **Step 5: Verify admin-only enforcement at the database layer**

6. While logged in as the non-admin test user, open the browser devtools console on `/app/upgrade` (or any `/app/*` page) and run:
   ```js
   fetch("/_supabase_placeholder") // skip — instead:
   ```
   Simpler: confirm via the UI that visiting `/app/admin` directly as the non-admin user redirects to `/app` (already covered in Task 5 Step 5) — this proves the layout guard. To confirm the *database* also rejects it (defense in depth, not just the route), as the non-admin user's session, temporarily comment out the `redirect` line in `src/app/app/admin/layout.tsx`, reload `/app/admin`, and attempt to generate a code. Expected: `generateCode` returns `{ ok: false, error: "Kod yaratib bo‘lmadi. Admin huquqini tekshiring." }` because `admin_generate_code` raises `not authorized`. Revert the temporary edit afterward (`git checkout -- src/app/app/admin/layout.tsx`).

- [ ] **Step 6: Verify direct admin credit grant**

7. As admin on `/app/admin`, find the non-admin test workspace in the workspace directory, enter an amount (e.g. `10`) and click "Qo‘shish". Expected: balance column updates after refresh; `credit_ledger` has a new `+10` row with `reason = 'admin_adjust'` and `note = 'admin panel'`.

- [ ] **Step 7: Verify code voiding**

8. As admin, generate a new code, then click "Bekor qilish" (void) on it before anyone redeems it. Expected: status changes to `Bekor qilingan`; attempting to redeem that code from `/app/upgrade` returns "Bu kod bekor qilingan."

- [ ] **Step 8: Final commit**

If Step 5's temporary edit was reverted cleanly and no other changes are outstanding, there's nothing to commit. Otherwise:

```bash
git status
git add -A
git commit -m "chore: finalize billing & activation workflow verification"
```
