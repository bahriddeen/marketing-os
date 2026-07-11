# AI Marketing OS — MVP Core (Phases 0–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working deployed app where a user signs up, gets a workspace with trial credits, creates a brand (optionally AI-pre-filled from a pasted description), and generates Uzbek marketing copy from that brand's context — with token usage and credits tracked.

**Architecture:** Next.js App Router (TypeScript) monolith. Supabase provides Postgres (with RLS), auth, and session management via `@supabase/ssr`. All Anthropic calls go through server-side code only, via a single shared generation engine (`src/lib/ai/`) that every module reuses: brand context (cached prefix) + module template + user input → structured output → log tokens → spend credits.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `@anthropic-ai/sdk` (model `claude-opus-4-8`), Zod, Vitest.

## Global Constraints

- All UI copy is **Uzbek (Latin)**. All generated content is Uzbek. No language switcher.
- Model is exactly `claude-opus-4-8`. Always pass `thinking: {type: "adaptive"}` (on Opus 4.8, omitting the field runs *without* thinking).
- `ANTHROPIC_API_KEY` and Supabase service keys never reach the client. AI calls only in server routes/actions.
- Every generation writes a row to `generations` with token usage and a negative `credit_ledger` delta. Failed generations spend no credits.
- Credit weights: `copy` = 1, `reels` = 3, `content_plan` = 10, `chat` = 1, `brand_fill` = 0 (free onboarding aid).
- Trial grant: 30 credits, plan `trial`.
- Commit after every task (messages below).

---

### Task 1: Scaffold Next.js + tooling

**Files:**
- Create: entire Next.js scaffold at repo root (`src/app/...`, `package.json`, etc.)
- Create: `vitest.config.ts`, `.env.example`
- Modify: `.gitignore` (ensure `.env*.local` ignored — scaffold does this)

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` (vitest) all work.

- [ ] **Step 1: Scaffold**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

(`docs/` and `.git/` are on create-next-app's allowlist; scaffolding in place is fine.)

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr zod
npm install -D vitest
```

- [ ] **Step 3: Add vitest config and test script**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

In `package.json` scripts add: `"test": "vitest run"`.

- [ ] **Step 4: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

- [ ] **Step 5: Verify**

Run: `npm run build` → succeeds. `npm test` → "no test files found" exit 0 (or passes trivially).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js app with Supabase/Anthropic deps and vitest"
```

---

### Task 2: Database schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `workspaces`, `workspace_members`, `brands`, `generations`, `chat_conversations`, `chat_messages`, `credit_ledger`; helper fn `public.is_member(uuid)`.

- [ ] **Step 1: Write migration**

`supabase/migrations/0001_init.sql`:
```sql
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  plan text not null default 'trial' check (plan in ('trial','starter','professional','agency')),
  plan_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null default 'owner' check (role in ('owner','member')),
  primary key (workspace_id, user_id)
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  industry text,
  products jsonb not null default '[]',
  services jsonb not null default '[]',
  usp text,
  target_audience jsonb not null default '[]',
  competitors jsonb not null default '[]',
  tone_of_voice text,
  brand_values text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  user_id uuid not null references auth.users(id),
  module text not null check (module in ('content_plan','reels','copy','chat','brand_fill')),
  input jsonb not null default '{}',
  output jsonb,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  credits_spent int not null default 0,
  created_at timestamptz not null default now()
);

create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('generation','plan_grant','admin_adjust')),
  generation_id uuid references generations(id),
  created_at timestamptz not null default now()
);

-- Membership helper (security definer avoids RLS recursion)
create or replace function public.is_member(w uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = w and user_id = auth.uid()
  );
$$;

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table brands enable row level security;
alter table generations enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table credit_ledger enable row level security;

create policy ws_select on workspaces for select using (is_member(id));
create policy ws_insert on workspaces for insert with check (owner_id = auth.uid());
create policy ws_update on workspaces for update using (owner_id = auth.uid());

create policy wm_select on workspace_members for select using (user_id = auth.uid() or is_member(workspace_id));
create policy wm_insert on workspace_members for insert with check (
  user_id = auth.uid()
  and exists (select 1 from workspaces where id = workspace_id and owner_id = auth.uid())
);

create policy brands_all on brands for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy gen_all on generations for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy conv_all on chat_conversations for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy msg_all on chat_messages for all
  using (exists (select 1 from chat_conversations c where c.id = conversation_id and is_member(c.workspace_id)))
  with check (exists (select 1 from chat_conversations c where c.id = conversation_id and is_member(c.workspace_id)));
create policy ledger_select on credit_ledger for select using (is_member(workspace_id));
create policy ledger_insert on credit_ledger for insert with check (is_member(workspace_id));
```

- [ ] **Step 2: Apply to Supabase project**

Founder creates a free project at supabase.com; run the SQL in the Supabase SQL editor (or `supabase db push` if CLI linked). Record URL + anon key into `.env.local`.

- [ ] **Step 3: Verify**

In Supabase Table Editor: all 7 tables exist, RLS shows "enabled" on each.

- [ ] **Step 4: Commit**

```bash
git add supabase && git commit -m "feat: initial schema with workspace-scoped RLS"
```

---

### Task 3: Supabase clients + auth middleware

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/middleware.ts`
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: `createClient()` (server, async) and `createBrowserClient()`; middleware refreshes sessions and redirects unauthenticated users from `/app/*` to `/login`.
- Produces types: `Brand`, `Workspace` used by all later tasks.

- [ ] **Step 1: Server client**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {} // called from a Server Component — middleware handles refresh
        },
      },
    }
  );
}
```

- [ ] **Step 2: Browser client**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient as create } from "@supabase/ssr";

export function createBrowserClient() {
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Middleware**

`src/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/app/:path*", "/login", "/signup"] };
```

- [ ] **Step 4: Shared types**

`src/lib/types.ts`:
```ts
export type Workspace = {
  id: string; name: string; owner_id: string;
  plan: "trial" | "starter" | "professional" | "agency";
  plan_expires_at: string | null;
};

export type Brand = {
  id: string; workspace_id: string; name: string;
  industry: string | null;
  products: string[]; services: string[];
  usp: string | null;
  target_audience: string[]; competitors: string[];
  tone_of_voice: string | null; brand_values: string | null;
};
```

- [ ] **Step 5: Verify** — `npm run build` passes.

- [ ] **Step 6: Commit**

```bash
git add src && git commit -m "feat: supabase clients, session middleware, shared types"
```

---

### Task 4: Auth pages + workspace bootstrap

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/auth/actions.ts`
- Create: `src/lib/workspace.ts`

**Interfaces:**
- Consumes: `createClient()` from Task 3.
- Produces: `getOrCreateWorkspace(): Promise<Workspace>` — returns caller's workspace, creating workspace + membership + 30-credit trial grant on first call. All `/app` pages call this.

- [ ] **Step 1: Auth server actions**

`src/app/auth/actions.ts`:
```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect("/login?error=" + encodeURIComponent("Email yoki parol noto‘g‘ri"));
  redirect("/app");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect("/signup?error=" + encodeURIComponent(error.message));
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

(Supabase project setting: disable email confirmation for MVP so signUp returns a session immediately.)

- [ ] **Step 2: Login/signup pages (Uzbek copy)**

`src/app/login/page.tsx`:
```tsx
import { signIn } from "@/app/auth/actions";
import Link from "next/link";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form action={signIn} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold">Kirish</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input name="email" type="email" required placeholder="Email" className="w-full rounded border p-2" />
        <input name="password" type="password" required placeholder="Parol" className="w-full rounded border p-2" />
        <button className="w-full rounded bg-black p-2 text-white">Kirish</button>
        <p className="text-sm">Akkaunt yo‘qmi? <Link className="underline" href="/signup">Ro‘yxatdan o‘tish</Link></p>
      </form>
    </main>
  );
}
```

`src/app/signup/page.tsx` — same layout with `action={signUp}`, heading `Ro‘yxatdan o‘tish`, link back to `/login` ("Akkauntingiz bormi? Kirish").

- [ ] **Step 3: Workspace bootstrap**

`src/lib/workspace.ts`:
```ts
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import { redirect } from "next/navigation";

export async function getOrCreateWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members").select("workspace_id").eq("user_id", user.id).maybeSingle();

  if (membership) {
    const { data: ws } = await supabase
      .from("workspaces").select("*").eq("id", membership.workspace_id).single();
    return ws as Workspace;
  }

  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({ name: "Mening jamoam", owner_id: user.id, plan: "trial" })
    .select().single();
  if (error) throw error;
  await supabase.from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });
  await supabase.from("credit_ledger")
    .insert({ workspace_id: ws.id, delta: 30, reason: "plan_grant" });
  return ws as Workspace;
}

export async function getCreditBalance(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("credit_ledger").select("delta").eq("workspace_id", workspaceId);
  return (data ?? []).reduce((sum, r) => sum + r.delta, 0);
}
```

- [ ] **Step 4: Verify manually**

`npm run dev` → sign up with a test email → check Supabase tables: 1 workspace, 1 membership, ledger row `+30`.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: auth pages and workspace bootstrap with trial credits"
```

---

### Task 5: App shell (dashboard layout)

**Files:**
- Create: `src/app/app/layout.tsx`, `src/app/app/page.tsx`
- Modify: `src/app/page.tsx` (root → redirect to `/app`)

**Interfaces:**
- Consumes: `getOrCreateWorkspace`, `getCreditBalance`, `signOut`.
- Produces: sidebar nav with links `/app` (Bosh sahifa), `/app/brands` (Brendlar), `/app/copy` (Kopiraiting); credit balance badge.

- [ ] **Step 1: Layout**

`src/app/app/layout.tsx`:
```tsx
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import { signOut } from "@/app/auth/actions";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r bg-white p-4 flex flex-col gap-2">
        <h2 className="mb-4 text-lg font-bold">AI Marketing OS</h2>
        <Link href="/app" className="rounded p-2 hover:bg-gray-100">Bosh sahifa</Link>
        <Link href="/app/brands" className="rounded p-2 hover:bg-gray-100">Brendlar</Link>
        <Link href="/app/copy" className="rounded p-2 hover:bg-gray-100">Kopiraiting</Link>
        <div className="mt-auto space-y-2">
          <p className="rounded bg-gray-100 p-2 text-sm">Kreditlar: <b>{credits}</b></p>
          <form action={signOut}><button className="text-sm text-gray-500 underline">Chiqish</button></form>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Home page** — `src/app/app/page.tsx` renders workspace name + short intro ("Brend yarating va kontent generatsiya qiling"). Root `src/app/page.tsx` becomes `redirect("/app")`.

- [ ] **Step 3: Verify** — dev server: after login, sidebar shows, credits show 30.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: app shell with sidebar and credit balance"
```

---

### Task 6: Brand CRUD

**Files:**
- Create: `src/app/app/brands/page.tsx` (list), `src/app/app/brands/new/page.tsx`, `src/app/app/brands/[id]/page.tsx` (edit), `src/app/app/brands/actions.ts`, `src/components/BrandForm.tsx`

**Interfaces:**
- Consumes: `Brand` type, `getOrCreateWorkspace`.
- Produces: `saveBrand(formData)` server action (insert or update by hidden `id`); `deleteBrand(id)`. Array fields (products, services, target_audience, competitors) entered as one-per-line textareas, stored as `string[]`.

- [ ] **Step 1: Server actions**

`src/app/app/brands/actions.ts`:
```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "").split("\n").map(s => s.trim()).filter(Boolean);

export async function saveBrand(formData: FormData) {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const row = {
    workspace_id: ws.id,
    name: String(formData.get("name")),
    industry: String(formData.get("industry") ?? ""),
    products: lines(formData.get("products")),
    services: lines(formData.get("services")),
    usp: String(formData.get("usp") ?? ""),
    target_audience: lines(formData.get("target_audience")),
    competitors: lines(formData.get("competitors")),
    tone_of_voice: String(formData.get("tone_of_voice") ?? ""),
    brand_values: String(formData.get("brand_values") ?? ""),
    updated_at: new Date().toISOString(),
  };
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("brands").update(row).eq("id", id)
    : await supabase.from("brands").insert(row);
  if (error) throw error;
  revalidatePath("/app/brands");
  redirect("/app/brands");
}

export async function deleteBrand(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("brands").delete().eq("id", String(formData.get("id")));
  revalidatePath("/app/brands");
  redirect("/app/brands");
}
```

- [ ] **Step 2: BrandForm component**

`src/components/BrandForm.tsx` — plain form (no client JS needed) with Uzbek labels; fields: Brend nomi*, Soha, Mahsulotlar (har qatorda bittadan), Xizmatlar, USP (asosiy afzallik), Maqsadli auditoriya, Raqobatchilar, Ohang (Tone of Voice), Brend qadriyatlari. Accepts `brand?: Brand` to prefill and hidden `id` input when editing; `action={saveBrand}`.

- [ ] **Step 3: List + pages**

`/app/brands` lists brand cards (name, industry, edit link) + "Yangi brend" button → `/app/brands/new`. Edit page loads the brand by id and renders `BrandForm`.

- [ ] **Step 4: Verify** — create brand "Vetline", edit it, confirm arrays round-trip; second test user cannot see it (RLS check via separate browser profile).

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: brand knowledge base CRUD"
```

---

### Task 7: Generation engine core (pure logic, TDD)

**Files:**
- Create: `src/lib/ai/prompts.ts`, `src/lib/ai/credits.ts`, `src/lib/ai/schemas.ts`
- Test: `src/lib/ai/engine.test.ts`

**Interfaces:**
- Produces:
  - `CREDIT_WEIGHTS: Record<ModuleId, number>` and `type ModuleId = "content_plan" | "reels" | "copy" | "chat" | "brand_fill"` (in `credits.ts`)
  - `buildBrandContext(brand: Brand): string` (in `prompts.ts`) — stable, deterministic string (cache prefix)
  - `BrandFillSchema`, `CopyVariantsSchema` Zod schemas (in `schemas.ts`)

- [ ] **Step 1: Write failing tests**

`src/lib/ai/engine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildBrandContext } from "./prompts";
import { CREDIT_WEIGHTS } from "./credits";
import { CopyVariantsSchema } from "./schemas";
import type { Brand } from "@/lib/types";

const brand: Brand = {
  id: "b1", workspace_id: "w1", name: "Vetline",
  industry: "Veterinariya", products: ["Hayvon ozuqasi"], services: ["Vet konsultatsiya"],
  usp: "24/7 xizmat", target_audience: ["Uy hayvoni egalari"],
  competitors: ["ZooMed"], tone_of_voice: "Do‘stona", brand_values: "G‘amxo‘rlik",
};

describe("buildBrandContext", () => {
  it("includes all brand fields", () => {
    const ctx = buildBrandContext(brand);
    for (const s of ["Vetline", "Veterinariya", "Hayvon ozuqasi", "24/7 xizmat", "Uy hayvoni egalari", "Do‘stona"]) {
      expect(ctx).toContain(s);
    }
  });
  it("is deterministic (cache-safe)", () => {
    expect(buildBrandContext(brand)).toBe(buildBrandContext(brand));
    expect(buildBrandContext(brand)).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no dates/timestamps
  });
});

describe("credits", () => {
  it("has spec weights", () => {
    expect(CREDIT_WEIGHTS).toEqual({ content_plan: 10, reels: 3, copy: 1, chat: 1, brand_fill: 0 });
  });
});

describe("CopyVariantsSchema", () => {
  it("accepts 2-3 variants and rejects empty", () => {
    expect(CopyVariantsSchema.safeParse({ variants: [{ text: "a" }, { text: "b" }] }).success).toBe(true);
    expect(CopyVariantsSchema.safeParse({ variants: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/lib/ai/credits.ts`:
```ts
export type ModuleId = "content_plan" | "reels" | "copy" | "chat" | "brand_fill";
export const CREDIT_WEIGHTS: Record<ModuleId, number> = {
  content_plan: 10, reels: 3, copy: 1, chat: 1, brand_fill: 0,
};
```

`src/lib/ai/prompts.ts`:
```ts
import type { Brand } from "@/lib/types";

const list = (items: string[]) => (items.length ? items.map(i => `- ${i}`).join("\n") : "- (kiritilmagan)");

export function buildBrandContext(brand: Brand): string {
  return `# Brend ma'lumotlari

Kompaniya: ${brand.name}
Soha: ${brand.industry || "(kiritilmagan)"}

Mahsulotlar:
${list(brand.products)}

Xizmatlar:
${list(brand.services)}

USP (asosiy afzallik): ${brand.usp || "(kiritilmagan)"}

Maqsadli auditoriya:
${list(brand.target_audience)}

Raqobatchilar:
${list(brand.competitors)}

Ohang (tone of voice): ${brand.tone_of_voice || "(kiritilmagan)"}
Brend qadriyatlari: ${brand.brand_values || "(kiritilmagan)"}`;
}

export const SYSTEM_BASE = `Siz O‘zbekiston bozori uchun ishlaydigan professional marketing va SMM mutaxassisisiz.
Barcha javoblar tabiiy, ona tilidek o‘zbek (lotin) tilida bo‘lsin — tarjima qilingan matnga o‘xshamasin.
O‘zbek SMM'da real ishlatiladigan marketing uslubidan foydalaning.
Har doim yuqoridagi brend ma'lumotlariga (ohang, auditoriya, USP) tayangan holda yozing.`;
```

`src/lib/ai/schemas.ts`:
```ts
import { z } from "zod";

export const CopyVariantsSchema = z.object({
  variants: z.array(z.object({ text: z.string() })).min(1).max(3),
});

export const BrandFillSchema = z.object({
  name: z.string(),
  industry: z.string(),
  products: z.array(z.string()),
  services: z.array(z.string()),
  usp: z.string(),
  target_audience: z.array(z.string()),
  competitors: z.array(z.string()),
  tone_of_voice: z.string(),
  brand_values: z.string(),
});
```

- [ ] **Step 4: Run tests** — `npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: generation engine primitives (prompts, credits, schemas) with tests"
```

---

### Task 8: Engine runtime — Anthropic call + logging + credit spend

**Files:**
- Create: `src/lib/ai/engine.ts`

**Interfaces:**
- Consumes: Task 7 primitives; `createClient` (Task 3).
- Produces:
```ts
runStructuredGeneration<T>(opts: {
  workspaceId: string; userId: string; brandId: string | null;
  module: ModuleId; brandContext: string; moduleInstructions: string;
  userInput: string; inputRecord: Record<string, unknown>;
  schema: ZodType<T>; maxTokens?: number;
}): Promise<{ ok: true; data: T; creditsLeft: number } | { ok: false; error: string }>
```
Behavior: checks credit balance ≥ weight before calling; on success saves `generations` row + negative ledger delta; on failure saves nothing to ledger.

- [ ] **Step 1: Implement**

`src/lib/ai/engine.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_WEIGHTS, type ModuleId } from "./credits";
import { SYSTEM_BASE } from "./prompts";

const MODEL = "claude-opus-4-8";
const client = new Anthropic();

export async function runStructuredGeneration<T>(opts: {
  workspaceId: string; userId: string; brandId: string | null;
  module: ModuleId; brandContext: string; moduleInstructions: string;
  userInput: string; inputRecord: Record<string, unknown>;
  schema: ZodType<T>; maxTokens?: number;
}): Promise<{ ok: true; data: T; creditsLeft: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const weight = CREDIT_WEIGHTS[opts.module];

  const { data: ledger } = await supabase
    .from("credit_ledger").select("delta").eq("workspace_id", opts.workspaceId);
  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  if (balance < weight) return { ok: false, error: "Kreditlar yetarli emas. Tarifni yangilang." };

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
        { type: "text", text: opts.brandContext + "\n\n" + opts.moduleInstructions,
          cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: opts.userInput }],
      output_config: { format: zodOutputFormat(opts.schema) },
    });
  } catch (e) {
    console.error("generation failed", e);
    return { ok: false, error: "Generatsiya xatosi. Qayta urinib ko‘ring." };
  }

  const data = response.parsed_output;
  if (!data) return { ok: false, error: "Natijani o‘qib bo‘lmadi. Qayta urinib ko‘ring." };

  const { data: gen } = await supabase.from("generations").insert({
    workspace_id: opts.workspaceId, brand_id: opts.brandId, user_id: opts.userId,
    module: opts.module, input: opts.inputRecord, output: data as object,
    model: MODEL,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
    credits_spent: weight,
  }).select("id").single();

  if (weight > 0) {
    await supabase.from("credit_ledger").insert({
      workspace_id: opts.workspaceId, delta: -weight,
      reason: "generation", generation_id: gen?.id ?? null,
    });
  }
  return { ok: true, data, creditsLeft: balance - weight };
}
```

- [ ] **Step 2: Verify** — `npm run build` passes; `npm test` still green.

- [ ] **Step 3: Commit**

```bash
git add src && git commit -m "feat: structured generation runtime with caching, token log, credit spend"
```

---

### Task 9: AI brand-fill (paste description → prefilled form)

**Files:**
- Create: `src/app/app/brands/new/BrandFillBox.tsx` (client component), `src/app/api/brand-fill/route.ts`
- Modify: `src/app/app/brands/new/page.tsx`, `src/components/BrandForm.tsx` (accept `initial?: Partial<Brand>`)

**Interfaces:**
- Consumes: `runStructuredGeneration`, `BrandFillSchema`.
- Produces: `POST /api/brand-fill` `{ description: string }` → `{ ok: true, data: BrandFill }`; the new-brand page passes the result into `BrandForm` as initial values.

- [ ] **Step 1: API route**

`src/app/api/brand-fill/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { BrandFillSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  const { description } = await req.json();
  if (!description || String(description).length < 30) {
    return NextResponse.json({ ok: false, error: "Kamida 30 belgi kiriting." }, { status: 400 });
  }
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const result = await runStructuredGeneration({
    workspaceId: ws.id, userId: user!.id, brandId: null,
    module: "brand_fill",
    brandContext: "",
    moduleInstructions:
      "Foydalanuvchi kompaniyasi haqida erkin matn yuboradi. Undan brend kartochkasi maydonlarini o‘zbek (lotin) tilida to‘ldiring. Ma'lumot yetishmasa, sohaga mos oqilona taxmin qiling.",
    userInput: String(description),
    inputRecord: { description },
    schema: BrandFillSchema,
    maxTokens: 2048,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
```

- [ ] **Step 2: Client box**

`BrandFillBox.tsx`: textarea ("Kompaniyangiz haqida erkin yozing — AI formani o‘zi to‘ldiradi") + button "AI bilan to‘ldirish"; on success calls `onFill(data)` which the page uses to set `BrandForm` initial values (lift state in a small client wrapper around the form, or simplest: `BrandFillBox` renders the form itself client-side with `useState` initial values and posts via the existing `saveBrand` action).

- [ ] **Step 3: Verify manually** — paste a 3-4 sentence Uzbek company description; form fields populate; `generations` row appears with `module='brand_fill'`, `credits_spent=0`.

- [ ] **Step 4: Commit**

```bash
git add src && git commit -m "feat: AI brand-fill onboarding"
```

---

### Task 10: Copywriting module

**Files:**
- Create: `src/app/app/copy/page.tsx`, `src/app/app/copy/CopyForm.tsx` (client), `src/app/api/generate/copy/route.ts`
- Create: `src/lib/ai/modules/copy.ts`

**Interfaces:**
- Consumes: engine, `CopyVariantsSchema`, brands list.
- Produces: `POST /api/generate/copy` `{ brandId, type, topic, style }` → `{ ok, data: { variants: [{text}] }, creditsLeft }`. Types: `instagram_caption | telegram_post | ad_copy | landing | sms | push`; styles: `formal | sales | premium | friendly`.

- [ ] **Step 1: Module instructions**

`src/lib/ai/modules/copy.ts`:
```ts
export const COPY_TYPES = {
  instagram_caption: "Instagram post uchun caption (emoji va hashtag bilan, 100–200 so‘z)",
  telegram_post: "Telegram kanal posti (aniq struktura, CTA bilan)",
  ad_copy: "Reklama matni (target reklama uchun qisqa va kuchli)",
  landing: "Landing sahifa bo‘limi (sarlavha + matn + CTA)",
  sms: "SMS xabar (maksimum 160 belgi)",
  push: "Push-bildirishnoma (sarlavha maksimum 40 belgi, matn maksimum 120 belgi)",
} as const;

export const COPY_STYLES = {
  formal: "rasmiy", sales: "sotuvga yo‘naltirilgan", premium: "premium", friendly: "do‘stona",
} as const;

export function copyInstructions(type: keyof typeof COPY_TYPES, style: keyof typeof COPY_STYLES) {
  return `# Vazifa: Kopiraiting
Format: ${COPY_TYPES[type]}
Uslub: ${COPY_STYLES[style]}
3 ta turli variant yozing. Har biri brend ohangiga mos, o‘zbek (lotin) tilida.`;
}
```

- [ ] **Step 2: API route** — mirrors Task 9 route: validates body, loads brand by id (RLS-scoped), builds `buildBrandContext(brand)` + `copyInstructions(type, style)`, `module: "copy"`, `userInput: "Mavzu/oferta: " + topic`, schema `CopyVariantsSchema`.

- [ ] **Step 3: UI** — `CopyForm.tsx`: brand select, type select, style select, topic textarea, submit "Generatsiya qilish (1 kredit)"; renders variants as cards with a "Nusxalash" (copy-to-clipboard) button; shows remaining credits from response; error banner for `ok: false`.

- [ ] **Step 4: Verify end-to-end** — generate captions for Vetline; check: 3 Uzbek variants render; `generations` row logged with tokens; ledger −1; second run shows `cache_read_tokens > 0` (cache warm within 5 min).

- [ ] **Step 5: Commit**

```bash
git add src && git commit -m "feat: copywriting generator module"
```

---

### Task 11: Deploy + end-to-end verification

**Files:**
- Create: `README.md` (setup: env vars, migration, run)

**Steps:**

- [ ] **Step 1: Push to GitHub, import to Vercel**, set env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`).
- [ ] **Step 2: Production smoke test** — fresh signup → workspace + 30 credits → create brand via AI-fill → generate copy → credits 29 → sign out/in persists everything.
- [ ] **Step 3: Cost check** — in Supabase: `select module, avg(input_tokens), avg(output_tokens), avg(cache_read_tokens) from generations group by module;` — confirm copy generation lands near the spec estimate (~2.5K in / ~0.8K out).
- [ ] **Step 4: Commit + tag**

```bash
git add README.md && git commit -m "docs: setup README" && git tag phase-2-complete
```

---

## Self-Review Notes

- Spec coverage (phases 0–2): foundation ✓ (Tasks 1–5), Brand KB + AI-fill ✓ (Tasks 6, 9), engine with caching/structured-output/token-log/credits ✓ (Tasks 7–8), Copywriting ✓ (Task 10), deployed ✓ (Task 11). Content Planner/Reels/Chat/admin are phases 3–6 → next plan.
- Types consistent: `ModuleId`, `CREDIT_WEIGHTS`, `buildBrandContext`, `runStructuredGeneration` names match across tasks.
- External dependencies: Supabase project creation (Task 2 Step 2) and env keys (Task 11) need the founder's accounts.
