# Content Planner (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a saved, editable, exportable (xlsx/CSV) content plan of up to 30 posts from a brand's knowledge base.

**Architecture:** One new `content_plans` table (posts as a jsonb array; `generations` stays a pure audit log). Generation follows the existing module recipe through `runStructuredGeneration`. Three pages under `/app/plan` (list, new, detail) plus two API routes (generate, export). Per-post editing via a server action that merges into the jsonb.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS via `is_member()`), Anthropic structured outputs (Zod v4), `exceljs` (new dep), Tailwind v4 semantic tokens, vitest.

**Design spec:** `docs/superpowers/specs/2026-07-12-content-planner-design.md`

## Global Constraints

- All UI copy and AI output: Uzbek (Latin) only. No Russian/English except the product name "AI Marketing OS" and loanwords already used in the codebase (Hook, CTA, Format).
- Apostrophe in `o‘`/`g‘` and tutuq belgisi is **U+2018 (`‘`)** — never U+2019 (`’`) or `'`. HTML entities (`&apos;`) only inside literal JSX text, never in JS strings.
- Never say bare "AI" as a common noun in UI copy — use "sun‘iy intellekt".
- Colors: only semantic utilities (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `border-line`, `bg-surface`, `text-danger`, `bg-accent-soft`) — no raw palette colors or hex.
- Forms/buttons use `src/components/ui/` primitives (`Button`, `Input`, `Select`, `Textarea`, `Label`, `Card`).
- Next.js 16: dynamic route `params` is a **Promise** — `const { id } = await params;`. If unsure about an API, read `node_modules/next/dist/docs/` first.
- Tests are colocated (`src/**/*.test.ts`), run with `npx vitest run <file>`; full gates: `npm test` and `npx tsc --noEmit`.
- Commit after every task (message style: `feat:`/`docs:`/`chore:` like existing history).

---

### Task 1: `content_plans` migration

**Files:**
- Create: `supabase/migrations/0003_content_plans.sql`

**Interfaces:**
- Produces: table `content_plans` with columns used by Tasks 6–11 (`id, workspace_id, brand_id, user_id, title, platform, goal, period_start, post_count, posts, generation_id, created_at, updated_at`).

- [ ] **Step 1: Write the migration**

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

create index content_plans_workspace_idx on content_plans (workspace_id, created_at desc);
```

- [ ] **Step 2: Apply to Supabase**

There is no CLI migration runner. Ask the user to paste the file contents into the Supabase SQL editor (project `mmfecqqpjpjzxwcbpcna`) and run it, then confirm. Code tasks 2–11 don't touch the DB until manual verification (Task 11), so implementation may continue while this is pending — but Task 11 blocks on it.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_content_plans.sql
git commit -m "feat: add content_plans table with RLS"
```

---

### Task 2: Plan output schema + DB row type

**Files:**
- Modify: `src/lib/ai/schemas.ts` (append)
- Modify: `src/lib/types.ts` (append)
- Test: `src/lib/ai/engine.test.ts` (append — schema tests live here alongside `CopyVariantsSchema`'s)

**Interfaces:**
- Produces: `PlanPostSchema`, `ContentPlanSchema` (Zod), types `PlanPost`, `ContentPlanOutput` from `@/lib/ai/schemas`; type `ContentPlan` from `@/lib/types`.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/ai/engine.test.ts`:

```ts
import { ContentPlanSchema } from "./schemas";

describe("ContentPlanSchema", () => {
  const post = {
    date: "2026-08-03",
    topic: "Uy hayvonlari uchun yozgi parvarish",
    format: "carousel",
    hook: "Yozda itingiz eng ko‘p nimadan aziyat chekadi?",
    cta: "Batafsil konsultatsiya uchun yozing",
    goal: "Auditoriyaga foyda berish",
  };

  it("accepts a valid plan", () => {
    const r = ContentPlanSchema.safeParse({ title: "Vetline — avgust", posts: [post] });
    expect(r.success).toBe(true);
  });

  it("rejects bad format enum and bad date", () => {
    expect(
      ContentPlanSchema.safeParse({ title: "t", posts: [{ ...post, format: "video" }] }).success
    ).toBe(false);
    expect(
      ContentPlanSchema.safeParse({ title: "t", posts: [{ ...post, date: "3-avgust" }] }).success
    ).toBe(false);
  });

  it("rejects empty posts", () => {
    expect(ContentPlanSchema.safeParse({ title: "t", posts: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ai/engine.test.ts`
Expected: FAIL — `ContentPlanSchema` is not exported.

- [ ] **Step 3: Implement** — append to `src/lib/ai/schemas.ts`:

```ts
export const PlanPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topic: z.string(),
  format: z.enum(["post", "carousel", "reels", "story"]),
  hook: z.string(),
  cta: z.string(),
  goal: z.string(),
});
export type PlanPost = z.infer<typeof PlanPostSchema>;

export const ContentPlanSchema = z.object({
  title: z.string(),
  posts: z.array(PlanPostSchema).min(1).max(31),
});
export type ContentPlanOutput = z.infer<typeof ContentPlanSchema>;
```

Append to `src/lib/types.ts`:

```ts
import type { PlanPost } from "@/lib/ai/schemas";

export type ContentPlan = {
  id: string;
  workspace_id: string;
  brand_id: string;
  user_id: string;
  title: string;
  platform: "instagram" | "telegram" | "both";
  goal: "awareness" | "engagement" | "sales";
  period_start: string;
  post_count: number;
  posts: PlanPost[];
  generation_id: string | null;
  created_at: string;
  updated_at: string;
};
```

(`import type` goes at the top of `types.ts`; the type at the bottom.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/ai/engine.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/schemas.ts src/lib/types.ts src/lib/ai/engine.test.ts
git commit -m "feat: add content plan output schema and ContentPlan type"
```

---

### Task 3: Content-plan module instructions

**Files:**
- Create: `src/lib/ai/modules/contentPlan.ts`
- Test: `src/lib/ai/modules/contentPlan.test.ts`

**Interfaces:**
- Consumes: `PlanPost` from `@/lib/ai/schemas` (Task 2).
- Produces: `PLAN_PLATFORMS`, `PLAN_GOALS`, `PLAN_GOAL_LABELS`, `PLAN_FORMAT_LABELS`, types `PlanPlatform`, `PlanGoal`, and `contentPlanInstructions(platform: PlanPlatform, goal: PlanGoal, postCount: number, periodStart: string): string`.

- [ ] **Step 1: Write the failing test** — `src/lib/ai/modules/contentPlan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PLAN_PLATFORMS,
  PLAN_GOALS,
  PLAN_FORMAT_LABELS,
  contentPlanInstructions,
} from "./contentPlan";

describe("contentPlanInstructions", () => {
  it("includes platform, goal, count and period", () => {
    const s = contentPlanInstructions("both", "sales", 20, "2026-08-01");
    expect(s).toContain("Instagram va Telegram");
    expect(s).toContain("sotuvni oshirish");
    expect(s).toContain("20 ta");
    expect(s).toContain("2026-08-01");
  });

  it("is deterministic for identical inputs (cache-safe)", () => {
    expect(contentPlanInstructions("instagram", "awareness", 10, "2026-08-01")).toBe(
      contentPlanInstructions("instagram", "awareness", 10, "2026-08-01")
    );
  });
});

describe("plan enums", () => {
  it("has the spec's platforms and goals", () => {
    expect(Object.keys(PLAN_PLATFORMS)).toEqual(["instagram", "telegram", "both"]);
    expect(Object.keys(PLAN_GOALS)).toEqual(["awareness", "engagement", "sales"]);
    expect(Object.keys(PLAN_FORMAT_LABELS)).toEqual(["post", "carousel", "reels", "story"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ai/modules/contentPlan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/ai/modules/contentPlan.ts`:

```ts
import type { PlanPost } from "@/lib/ai/schemas";

export const PLAN_PLATFORMS = {
  instagram: "Instagram",
  telegram: "Telegram",
  both: "Instagram va Telegram",
} as const;
export type PlanPlatform = keyof typeof PLAN_PLATFORMS;

export const PLAN_GOALS = {
  awareness: "brend tanilishini oshirish",
  engagement: "auditoriya faolligini oshirish",
  sales: "sotuvni oshirish",
} as const;
export type PlanGoal = keyof typeof PLAN_GOALS;

export const PLAN_GOAL_LABELS: Record<PlanGoal, string> = {
  awareness: "Tanilish",
  engagement: "Faollik",
  sales: "Sotuv",
};

export const PLAN_FORMAT_LABELS: Record<PlanPost["format"], string> = {
  post: "Post",
  carousel: "Karusel",
  reels: "Reels",
  story: "Story",
};

export function contentPlanInstructions(
  platform: PlanPlatform,
  goal: PlanGoal,
  postCount: number,
  periodStart: string
): string {
  return `# Vazifa: Kontent-plan
Platforma: ${PLAN_PLATFORMS[platform]}
Asosiy maqsad: ${PLAN_GOALS[goal]}
Postlar soni: ${postCount} ta
Davr: ${periodStart} sanasidan boshlanadigan bir oy

${postCount} ta postdan iborat kontent-plan tuzing:
- Har bir post uchun: sana (YYYY-MM-DD, faqat shu oy ichida), mavzu, format (post/carousel/reels/story), hook (dastlabki e‘tiborni tortadigan jumla), CTA va postning maqsadi.
- Sanalarni oy bo‘ylab teng taqsimlang, barqaror haftalik ritm saqlansin.
- Formatlarni aralashtiring: oddiy post, karusel, reels va story.
- Mavzular xilma-xil bo‘lsin: foydali maslahat, mahsulot yoki xizmat taqdimoti, ijtimoiy isbot, aksiya, brend hikoyasi.
- "title" maydoniga planga qisqa nom yozing (brend nomi + oy).`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/ai/modules/contentPlan.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/modules/contentPlan.ts src/lib/ai/modules/contentPlan.test.ts
git commit -m "feat: add content plan module instructions and enums"
```

---

### Task 4: Engine returns `generationId`

**Files:**
- Modify: `src/lib/ai/engine.ts:11-13` (result type) and `:93` (return)

**Interfaces:**
- Produces: `GenerationResult<T>` success arm gains `generationId: string | null`. Existing callers (`copy`, `brand-fill` routes) are unaffected — the field is additive.

- [ ] **Step 1: Modify the result type** — in `src/lib/ai/engine.ts` replace:

```ts
export type GenerationResult<T> =
  | { ok: true; data: T; creditsLeft: number }
  | { ok: false; error: string };
```

with:

```ts
export type GenerationResult<T> =
  | { ok: true; data: T; creditsLeft: number; generationId: string | null }
  | { ok: false; error: string };
```

and replace the final return:

```ts
  return { ok: true, data, creditsLeft: balance - weight, generationId: gen?.id ?? null };
```

- [ ] **Step 2: Verify**

Run: `npm test` — Expected: PASS (no behavior change to tested code).
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/engine.ts
git commit -m "feat: expose generationId from runStructuredGeneration"
```

---

### Task 5: Pure plan helpers (edit merge + filename)

**Files:**
- Create: `src/lib/plans.ts`
- Test: `src/lib/plans.test.ts`

**Interfaces:**
- Consumes: `PlanPost` from `@/lib/ai/schemas`.
- Produces: `PlanPostEdit` type, `mergePlanPost(posts: PlanPost[], index: number, edit: PlanPostEdit): PlanPost[]`, `planFilename(title: string, ext: "xlsx" | "csv"): string`.

- [ ] **Step 1: Write the failing tests** — `src/lib/plans.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergePlanPost, planFilename } from "./plans";
import type { PlanPost } from "@/lib/ai/schemas";

const posts: PlanPost[] = [
  { date: "2026-08-01", topic: "A", format: "post", hook: "h1", cta: "c1", goal: "g1" },
  { date: "2026-08-05", topic: "B", format: "reels", hook: "h2", cta: "c2", goal: "g2" },
];

describe("mergePlanPost", () => {
  it("updates only the target post and keeps the rest", () => {
    const out = mergePlanPost(posts, 1, { topic: "Yangi mavzu", format: "story" });
    expect(out[1]).toEqual({ ...posts[1], topic: "Yangi mavzu", format: "story" });
    expect(out[0]).toEqual(posts[0]);
    expect(posts[1].topic).toBe("B"); // input not mutated
  });

  it("throws on out-of-range index", () => {
    expect(() => mergePlanPost(posts, 2, { topic: "x" })).toThrow();
    expect(() => mergePlanPost(posts, -1, { topic: "x" })).toThrow();
  });
});

describe("planFilename", () => {
  it("slugifies the title and appends the extension", () => {
    expect(planFilename("Vetline — avgust plani", "xlsx")).toBe("vetline-avgust-plani.xlsx");
  });
  it("falls back when nothing survives sanitizing", () => {
    expect(planFilename("‘‘‘", "csv")).toBe("kontent-plan.csv");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/plans.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement** — `src/lib/plans.ts`:

```ts
import type { PlanPost } from "@/lib/ai/schemas";

export type PlanPostEdit = Partial<
  Pick<PlanPost, "topic" | "format" | "hook" | "cta" | "goal">
>;

export function mergePlanPost(
  posts: PlanPost[],
  index: number,
  edit: PlanPostEdit
): PlanPost[] {
  if (!Number.isInteger(index) || index < 0 || index >= posts.length) {
    throw new Error(`post index ${index} out of range`);
  }
  return posts.map((p, i) => (i === index ? { ...p, ...edit } : p));
}

export function planFilename(title: string, ext: "xlsx" | "csv"): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "kontent-plan"}.${ext}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/plans.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans.ts src/lib/plans.test.ts
git commit -m "feat: add plan post merge and filename helpers"
```

---

### Task 6: Export serializers (CSV + xlsx)

**Files:**
- Create: `src/lib/planExport.ts`
- Test: `src/lib/planExport.test.ts`
- Modify: `package.json` (add `exceljs`)

**Interfaces:**
- Consumes: `PlanPost` (Task 2), `PLAN_FORMAT_LABELS` (Task 3).
- Produces: `PLAN_EXPORT_HEADERS: string[]`, `planRows(posts: PlanPost[]): string[][]`, `planToCsv(posts: PlanPost[]): string`, `planToXlsx(title: string, posts: PlanPost[]): Promise<Uint8Array>`.

- [ ] **Step 1: Install exceljs**

Run: `npm install exceljs`

- [ ] **Step 2: Write the failing tests** — `src/lib/planExport.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PLAN_EXPORT_HEADERS, planRows, planToCsv, planToXlsx } from "./planExport";
import type { PlanPost } from "@/lib/ai/schemas";

const posts: PlanPost[] = [
  {
    date: "2026-08-01",
    topic: 'Mavzu, "qo‘shtirnoq" bilan',
    format: "carousel",
    hook: "Ko‘p qatorli\nhook",
    cta: "Yozing",
    goal: "Faollik",
  },
];

describe("planRows", () => {
  it("maps posts to rows with Uzbek format labels", () => {
    expect(planRows(posts)).toEqual([
      ["2026-08-01", 'Mavzu, "qo‘shtirnoq" bilan', "Karusel", "Ko‘p qatorli\nhook", "Yozing", "Faollik"],
    ]);
  });
});

describe("planToCsv", () => {
  it("starts with a UTF-8 BOM and the header row", () => {
    const csv = planToCsv(posts);
    expect(csv.startsWith("\uFEFF")).toBe(true);
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
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/planExport.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 4: Implement** — `src/lib/planExport.ts`:

```ts
import ExcelJS from "exceljs";
import type { PlanPost } from "@/lib/ai/schemas";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";

export const PLAN_EXPORT_HEADERS = ["Sana", "Mavzu", "Format", "Hook", "CTA", "Maqsad"];

export function planRows(posts: PlanPost[]): string[][] {
  return posts.map((p) => [
    p.date,
    p.topic,
    PLAN_FORMAT_LABELS[p.format],
    p.hook,
    p.cta,
    p.goal,
  ]);
}

const csvCell = (v: string) =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export function planToCsv(posts: PlanPost[]): string {
  const lines = [PLAN_EXPORT_HEADERS, ...planRows(posts)].map((row) =>
    row.map(csvCell).join(",")
  );
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export async function planToXlsx(
  title: string,
  posts: PlanPost[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31) || "Kontent-plan");
  ws.columns = [
    { header: "Sana", width: 12 },
    { header: "Mavzu", width: 44 },
    { header: "Format", width: 12 },
    { header: "Hook", width: 44 },
    { header: "CTA", width: 32 },
    { header: "Maqsad", width: 32 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const row of planRows(posts)) ws.addRow(row);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}
```

Note: Excel worksheet names are capped at 31 chars and may not contain `\ / ? * [ ]` — if the typecheck or a runtime error flags this, strip those chars too; plan titles are model-generated brand+month strings so the slice is normally enough.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/planExport.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean (if `writeBuffer()`'s return type complains about `Uint8Array`, wrap: `new Uint8Array(buf as ArrayBuffer)`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/planExport.ts src/lib/planExport.test.ts package.json package-lock.json
git commit -m "feat: add content plan CSV and xlsx serializers"
```

---

### Task 7: Generate API route

**Files:**
- Create: `src/app/api/generate/content-plan/route.ts`

**Interfaces:**
- Consumes: `runStructuredGeneration` (returns `generationId`, Task 4), `ContentPlanSchema` (Task 2), `contentPlanInstructions`/`PLAN_PLATFORMS`/`PLAN_GOALS` (Task 3), `buildBrandContext`, `getOrCreateWorkspace`, `createClient`.
- Produces: `POST /api/generate/content-plan` accepting `{ brandId, platform, goal, postCount, periodStart }`, returning `{ ok: true, planId, creditsLeft }` or `{ ok: false, error }`.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { ContentPlanSchema } from "@/lib/ai/schemas";
import { buildBrandContext } from "@/lib/ai/prompts";
import {
  PLAN_PLATFORMS,
  PLAN_GOALS,
  contentPlanInstructions,
  type PlanPlatform,
  type PlanGoal,
} from "@/lib/ai/modules/contentPlan";
import type { Brand } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { brandId, platform, goal, postCount, periodStart } = await req.json();

  if (!(platform in PLAN_PLATFORMS) || !(goal in PLAN_GOALS)) {
    return NextResponse.json(
      { ok: false, error: "Noto‘g‘ri platforma yoki maqsad." },
      { status: 400 }
    );
  }
  const count = Number(postCount);
  if (!Number.isInteger(count) || count < 1 || count > 30) {
    return NextResponse.json(
      { ok: false, error: "Postlar soni 1–30 oralig‘ida bo‘lsin." },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart))) {
    return NextResponse.json(
      { ok: false, error: "Davr sanasi noto‘g‘ri." },
      { status: 400 }
    );
  }

  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Avval tizimga kiring." }, { status: 401 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", String(brandId))
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ ok: false, error: "Brend topilmadi." }, { status: 404 });
  }

  const result = await runStructuredGeneration({
    workspaceId: ws.id,
    userId: user.id,
    brandId: brand.id,
    module: "content_plan",
    brandContext: buildBrandContext(brand as Brand),
    moduleInstructions: contentPlanInstructions(
      platform as PlanPlatform,
      goal as PlanGoal,
      count,
      String(periodStart)
    ),
    userInput: "Yuqoridagi parametrlar asosida kontent-plan tuzing.",
    inputRecord: { brandId, platform, goal, postCount: count, periodStart },
    schema: ContentPlanSchema,
    maxTokens: 12000,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

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
      posts: result.data.posts,
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

  return NextResponse.json({ ok: true, planId: plan.id, creditsLeft: result.creditsLeft });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run build` — Expected: compiles, route listed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/content-plan/route.ts
git commit -m "feat: add content plan generation API route"
```

---

### Task 8: Export API route

**Files:**
- Create: `src/app/api/plans/[id]/export/route.ts`

**Interfaces:**
- Consumes: `planToCsv`, `planToXlsx` (Task 6), `planFilename` (Task 5), `createClient`.
- Produces: `GET /api/plans/:id/export?format=xlsx|csv` → file download (defaults to xlsx).

- [ ] **Step 1: Implement the route**

```ts
import { createClient } from "@/lib/supabase/server";
import { planToCsv, planToXlsx } from "@/lib/planExport";
import { planFilename } from "@/lib/plans";
import type { PlanPost } from "@/lib/ai/schemas";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("content_plans")
    .select("title, posts")
    .eq("id", id)
    .maybeSingle();
  if (!plan) {
    return new Response("Topilmadi", { status: 404 });
  }

  const posts = plan.posts as PlanPost[];

  if (format === "csv") {
    return new Response(planToCsv(posts), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${planFilename(plan.title, "csv")}"`,
      },
    });
  }

  const buf = await planToXlsx(plan.title, posts);
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${planFilename(plan.title, "xlsx")}"`,
    },
  });
}
```

RLS makes foreign plans invisible, so the 404 covers both "missing" and "not yours".

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — Expected: clean (if `Response` rejects `Uint8Array` under the installed TS lib, pass `buf.buffer as ArrayBuffer` or `Buffer.from(buf)` instead).
Run: `npm run build` — Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plans/[id]/export/route.ts
git commit -m "feat: add plan xlsx/csv export route"
```

---

### Task 9: Sidebar entry + plan list page

**Files:**
- Modify: `src/components/app/Sidebar.tsx:4,9-13` (icon import + NAV)
- Create: `src/app/app/plan/page.tsx`

**Interfaces:**
- Consumes: `content_plans` table (Task 1), `PLAN_GOAL_LABELS` (Task 3), existing `Card`/`Button`, `getOrCreateWorkspace`, `createClient`.
- Produces: `/app/plan` list page; nav order becomes Bosh sahifa, Brendlar, Kontent-plan, Kopiraiting.

- [ ] **Step 1: Add the nav entry** — in `src/components/app/Sidebar.tsx` change the lucide import to include `CalendarDays`:

```ts
import { Home, Briefcase, CalendarDays, PenLine, LogOut } from "lucide-react";
```

and insert into `NAV` between Brendlar and Kopiraiting:

```ts
  { href: "/app/plan", label: "Kontent-plan", icon: CalendarDays, exact: false },
```

- [ ] **Step 2: Create the list page** — `src/app/app/plan/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type PlanListRow = {
  id: string;
  title: string;
  period_start: string;
  post_count: number;
  created_at: string;
  brands: { name: string } | null;
};

export default async function PlansPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_plans")
    .select("id, title, period_start, post_count, created_at, brands(name)")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const plans = (data ?? []) as unknown as PlanListRow[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Kontent-plan
        </h1>
        <Link href="/app/plan/new">
          <Button>Yangi plan</Button>
        </Link>
      </div>
      {plans.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">
            Hali kontent-planingiz yo‘q. Brend tanlang — sun‘iy intellekt bir
            oylik plan tuzib beradi.
          </p>
          <Link href="/app/plan/new" className="mt-4 inline-block">
            <Button>Birinchi planni yaratish</Button>
          </Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <h2 className="font-semibold text-ink">{p.title}</h2>
            <p className="text-sm text-muted">
              {p.brands?.name ?? "—"} · {p.period_start.slice(0, 7)} ·{" "}
              {p.post_count} ta post
            </p>
            <Link
              className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
              href={`/app/plan/${p.id}`}
            >
              Ochish
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

(The `as unknown as PlanListRow[]` cast is needed because supabase-js types joined relations loosely; the shape is correct at runtime — `brands(name)` on a to-one FK returns an object.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run build` — Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/Sidebar.tsx src/app/app/plan/page.tsx
git commit -m "feat: add content plan list page and sidebar entry"
```

---

### Task 10: New-plan form (generation UX)

**Files:**
- Create: `src/app/app/plan/new/page.tsx`
- Create: `src/app/app/plan/new/PlanForm.tsx`

**Interfaces:**
- Consumes: `POST /api/generate/content-plan` (Task 7), `PLAN_PLATFORMS`/`PLAN_GOAL_LABELS` (Task 3), `GeneratingCard`, UI primitives.
- Produces: `/app/plan/new` page; on success navigates to `/app/plan/<planId>` (Task 11's page).

- [ ] **Step 1: Server page** — `src/app/app/plan/new/page.tsx` (mirrors the copy page's brand loading):

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import PlanForm from "./PlanForm";

export default async function NewPlanPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const brands = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">
        Yangi kontent-plan
      </h1>
      {brands.length === 0 ? (
        <p className="text-muted">
          Avval brend qo‘shing —{" "}
          <Link
            className="font-medium text-accent hover:underline"
            href="/app/brands/new"
          >
            yangi brend yaratish
          </Link>
        </p>
      ) : (
        <PlanForm brands={brands} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Client form** — `src/app/app/plan/new/PlanForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLAN_PLATFORMS,
  PLAN_GOAL_LABELS,
  type PlanPlatform,
  type PlanGoal,
} from "@/lib/ai/modules/contentPlan";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Input";
import GeneratingCard from "@/components/ai/GeneratingCard";

const PLAN_STATUS_MESSAGES = [
  "Brendni o‘rganmoqda…",
  "Mavzular tanlanmoqda…",
  "Sanalar taqsimlanmoqda…",
  "Hook va CTA yozilmoqda…",
  "Plan jadvalga terilmoqda…",
  "Sayqallanmoqda…",
];

type BrandOption = { id: string; name: string };

export default function PlanForm({ brands }: { brands: BrandOption[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [platform, setPlatform] = useState<PlanPlatform>("instagram");
  const [goal, setGoal] = useState<PlanGoal>("engagement");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [postCount, setPostCount] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          platform,
          goal,
          postCount,
          periodStart: `${month}-01`,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push(`/app/plan/${json.planId}`);
        return;
      }
      setError(json.error ?? "Xatolik yuz berdi.");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="space-y-4">
        <label className="block">
          <Label>Brend</Label>
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Platforma</Label>
            <Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlanPlatform)}
            >
              {Object.entries(PLAN_PLATFORMS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <Label>Maqsad</Label>
            <Select
              value={goal}
              onChange={(e) => setGoal(e.target.value as PlanGoal)}
            >
              {Object.entries(PLAN_GOAL_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Oy</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className="block">
            <Label>Postlar soni</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={postCount}
              onChange={(e) => setPostCount(Number(e.target.value))}
            />
          </label>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleGenerate}
          disabled={
            loading || !brandId || !month || postCount < 1 || postCount > 30
          }
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (10 kredit)"}
        </Button>
        {loading && (
          <p className="text-sm text-muted">
            Bu eng katta generatsiya — 1–3 daqiqa vaqt olishi mumkin.
          </p>
        )}
      </Card>
      <GeneratingCard active={loading} messages={PLAN_STATUS_MESSAGES} />
    </div>
  );
}
```

Note: on success we navigate away without `setLoading(false)` so the progress state persists until the new page renders — that's intentional (the early `return` skips it).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run build` — Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/plan/new/
git commit -m "feat: add new content plan form with progress indicator"
```

---

### Task 11: Plan detail page — editable table + export buttons

**Files:**
- Create: `src/app/app/plan/actions.ts`
- Create: `src/app/app/plan/[id]/page.tsx`
- Create: `src/app/app/plan/[id]/PlanTable.tsx`

**Interfaces:**
- Consumes: `mergePlanPost`/`PlanPostEdit` (Task 5), `PlanPostSchema` (Task 2), `PLAN_FORMAT_LABELS` (Task 3), export route (Task 8), `ContentPlan` type (Task 2).
- Produces: `/app/plan/[id]` page; `updatePlanPost(planId: string, index: number, edit: PlanPostEdit): Promise<{ ok: true } | { ok: false; error: string }>` server action.

- [ ] **Step 1: Server action** — `src/app/app/plan/actions.ts`:

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PlanPostSchema, type PlanPost } from "@/lib/ai/schemas";
import { mergePlanPost, type PlanPostEdit } from "@/lib/plans";

const EditSchema = PlanPostSchema.pick({
  topic: true,
  format: true,
  hook: true,
  cta: true,
  goal: true,
}).partial();

export async function updatePlanPost(
  planId: string,
  index: number,
  edit: PlanPostEdit
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = EditSchema.safeParse(edit);
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("content_plans")
    .select("posts")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) {
    return { ok: false, error: "Plan topilmadi." };
  }

  let posts: PlanPost[];
  try {
    posts = mergePlanPost(plan.posts as PlanPost[], index, parsed.data);
  } catch {
    return { ok: false, error: "Post topilmadi." };
  }

  const { error } = await supabase
    .from("content_plans")
    .update({ posts, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) {
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  revalidatePath(`/app/plan/${planId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Detail page** — `src/app/app/plan/[id]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PlanTable from "./PlanTable";
import type { ContentPlan } from "@/lib/types";

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
      <PlanTable planId={plan.id} initialPosts={plan.posts} />
      <Link
        className="inline-block text-sm font-medium text-accent hover:underline"
        href="/app/plan"
      >
        ← Barcha planlar
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Editable table** — `src/app/app/plan/[id]/PlanTable.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import type { PlanPost } from "@/lib/ai/schemas";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";
import { updatePlanPost } from "../actions";
import Button from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";

const COLUMNS = ["Sana", "Mavzu", "Format", "Hook", "CTA", "Maqsad", ""];

export default function PlanTable({
  planId,
  initialPosts,
}: {
  planId: string;
  initialPosts: PlanPost[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<PlanPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(i: number) {
    setEditing(i);
    setDraft(posts[i]);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  function saveEdit() {
    if (editing === null || !draft) return;
    const index = editing;
    const next = draft;
    startTransition(async () => {
      const res = await updatePlanPost(planId, index, {
        topic: next.topic,
        format: next.format,
        hook: next.hook,
        cta: next.cta,
        goal: next.goal,
      });
      if (res.ok) {
        setPosts((ps) => ps.map((p, i) => (i === index ? next : p)));
        cancelEdit();
      } else {
        setError(res.error);
      }
    });
  }

  const set = (field: keyof PlanPost) => (value: string) =>
    setDraft((d) => (d ? { ...d, [field]: value } : d));

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-sm">
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
            {posts.map((p, i) =>
              editing === i && draft ? (
                <tr key={i} className="border-b border-line align-top">
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
                      onChange={(e) => set("format")(e.target.value)}
                    >
                      {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </Select>
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
                <tr key={i} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted">
                    {p.date}
                  </td>
                  <td className="px-3 py-2 text-ink">{p.topic}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {PLAN_FORMAT_LABELS[p.format]}
                  </td>
                  <td className="px-3 py-2 text-ink">{p.hook}</td>
                  <td className="px-3 py-2 text-ink">{p.cta}</td>
                  <td className="px-3 py-2 text-muted">{p.goal}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      onClick={() => startEdit(i)}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      Tahrirlash
                    </button>
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

Note: `set("format")` passes a string; `draft.format` is the enum. The `Select` only offers valid enum values, and the server action re-validates with Zod, so cast in the handler if TS complains: `set("format")(e.target.value as PlanPost["format"])` — prefer that explicit cast on the format field only.

- [ ] **Step 4: Verify**

Run: `npm test` — Expected: all PASS.
Run: `npx tsc --noEmit` and `npm run build` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/plan/
git commit -m "feat: add plan detail page with editable table and export"
```

---

### Task 12: Manual end-to-end verification

**Blocks on:** Task 1 Step 2 (migration applied in Supabase).

- [ ] **Step 1: Start dev server** — `npm run dev`, log in.
- [ ] **Step 2: Generate** — Kontent-plan → Yangi plan → pick a real brand (e.g. Vetline), Instagram, Faollik, current month, 10 posts → Generatsiya qilish. Progress card rotates; after ~1–2 min you land on `/app/plan/<id>` with a 10-row table, dates inside the chosen month, mixed formats, all Uzbek (Latin).
- [ ] **Step 3: Ledger + audit** — in Supabase: `credit_ledger` has a −10 `generation` row; `generations` has a `content_plan` row with token counts; `content_plans.generation_id` points at it.
- [ ] **Step 4: Edit** — Tahrirlash on a row, change Mavzu, Saqlash → row updates; reload page → edit persisted; `generations.output` unchanged (audit log untouched).
- [ ] **Step 5: Export** — download both Excel (.xlsx) and CSV; open each (Numbers/Excel/LibreOffice): header row + posts, Uzbek characters render correctly (BOM works).
- [ ] **Step 6: Validation + errors** — POST with `postCount: 40` via the form dev tools or curl → 400 Uzbek error; a second test user cannot open the plan URL (404) or export it.
- [ ] **Step 7: Gates** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean.
- [ ] **Step 8: Commit anything outstanding** and update the project memory/status if the user asks.

---

## Self-Review Notes

- **Spec coverage:** data model → Task 1–2; generation flow incl. engine `generationId` and `maxDuration` → Tasks 3, 4, 7; UI list/new/detail with editing → Tasks 9–11; export xlsx+CSV with BOM → Tasks 6, 8; testing section's four pure-logic targets → Tasks 2, 3, 5, 6; error handling → engine messages reused (Task 7), 404 export (Task 8), action errors (Task 11).
- **Out of scope honored:** no date editing (PlanTable renders date read-only), no per-post regeneration, no plan deletion.
- **Type consistency check:** `PlanPost`/`ContentPlanOutput` (Task 2) ↔ `contentPlanInstructions` signature (Task 3) ↔ route body (Task 7) ↔ `PlanPostEdit` (Task 5) ↔ `updatePlanPost` (Task 11) all use the same names/shapes.
- **External dependency:** Task 1 Step 2 (Supabase SQL editor) needs the founder; Task 12 blocks on it, Tasks 2–11 don't.
