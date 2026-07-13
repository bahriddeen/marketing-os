# Reels Scenario Generator (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 3 persona-tagged reels scripts (Ekspert/Emotsional/Sotuv) per request from a brand's knowledge base, rendered once with copy-to-clipboard — no saved history.

**Architecture:** Follows the exact engine recipe used by Copywriting: a module file (enums + instructions builder), a Zod output schema enforcing exactly 3 personas, an API route calling the existing `runStructuredGeneration`, and a client form + results page. No new DB table — `generations` (module `reels`, already weighted 3 credits) is the only persistence.

**Tech Stack:** Next.js 16 App Router, Anthropic structured outputs via `runStructuredGeneration` (Zod v4), Tailwind v4 semantic tokens, vitest.

**Design spec:** `docs/superpowers/specs/2026-07-13-reels-generator-design.md`

## Global Constraints

- All UI copy and AI output: Uzbek (Latin) only. No Russian/English except the product name "AI Marketing OS" and loanwords already used in the codebase (Hook, CTA, Caption).
- Apostrophe in `o‘`/`g‘` and tutuq belgisi is **U+2018 (`‘`)** — never U+2019 (`’`) or ASCII `'`.
- Never say bare "AI" as a common noun in UI copy — use "sun‘iy intellekt".
- Colors: only semantic utilities (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `border-line`, `bg-surface`, `text-danger`, `bg-accent-soft`) — no raw palette colors or hex.
- Forms/buttons use `src/components/ui/` primitives (`Button`, `Input`/`Textarea`/`Select`/`Label`, `Card`).
- Tests colocated (`src/**/*.test.ts`), run with `npx vitest run <file>`; full gates: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Commit after every task.

---

### Task 1: Reels output schema

**Files:**
- Modify: `src/lib/ai/schemas.ts` (append)
- Modify: `src/lib/ai/engine.test.ts` (append — schema tests live here alongside `CopyVariantsSchema`'s and `ContentPlanSchema`'s)

**Interfaces:**
- Produces: `ReelsPersonas` (tuple), `ReelsPersona` type, `ReelsVariantSchema`/`ReelsVariant`, `ReelsSchema`/`ReelsOutput` from `@/lib/ai/schemas`.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/ai/engine.test.ts`:

```ts
import { ReelsSchema } from "./schemas";

describe("ReelsSchema", () => {
  const variant = (persona: "expert" | "emotional" | "sales") => ({
    persona,
    hook: "Birinchi 3 soniyada diqqatni tortadigan jumla",
    scenes: ["0-3s: mahsulot yaqindan ko‘rsatiladi", "3-10s: foydalanish jarayoni"],
    voiceover: "Ovoz matni shu yerda",
    caption: "Caption matni",
    cta: "Batafsil ma'lumot uchun yozing",
    duration: "15–20 soniya",
  });

  it("accepts exactly 3 variants with distinct personas", () => {
    const r = ReelsSchema.safeParse({
      variants: [variant("expert"), variant("emotional"), variant("sales")],
    });
    expect(r.success).toBe(true);
  });

  it("rejects fewer than 3 variants", () => {
    expect(
      ReelsSchema.safeParse({ variants: [variant("expert"), variant("emotional")] }).success
    ).toBe(false);
  });

  it("rejects more than 3 variants", () => {
    expect(
      ReelsSchema.safeParse({
        variants: [variant("expert"), variant("emotional"), variant("sales"), variant("expert")],
      }).success
    ).toBe(false);
  });

  it("rejects an invalid persona value", () => {
    const bad = { ...variant("expert"), persona: "funny" };
    expect(
      ReelsSchema.safeParse({ variants: [bad, variant("emotional"), variant("sales")] }).success
    ).toBe(false);
  });

  it("rejects an empty scenes array", () => {
    const bad = { ...variant("expert"), scenes: [] };
    expect(
      ReelsSchema.safeParse({ variants: [bad, variant("emotional"), variant("sales")] }).success
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ai/engine.test.ts`
Expected: FAIL — `ReelsSchema` is not exported.

- [ ] **Step 3: Implement** — append to `src/lib/ai/schemas.ts`:

```ts
export const ReelsPersonas = ["expert", "emotional", "sales"] as const;
export type ReelsPersona = (typeof ReelsPersonas)[number];

export const ReelsVariantSchema = z.object({
  persona: z.enum(ReelsPersonas),
  hook: z.string(),
  scenes: z.array(z.string()).min(1),
  voiceover: z.string(),
  caption: z.string(),
  cta: z.string(),
  duration: z.string(),
});
export type ReelsVariant = z.infer<typeof ReelsVariantSchema>;

export const ReelsSchema = z.object({
  variants: z.array(ReelsVariantSchema).length(3),
});
export type ReelsOutput = z.infer<typeof ReelsSchema>;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/ai/engine.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/schemas.ts src/lib/ai/engine.test.ts
git commit -m "feat: add reels output schema"
```

---

### Task 2: Reels module instructions

**Files:**
- Create: `src/lib/ai/modules/reels.ts`
- Test: `src/lib/ai/modules/reels.test.ts`

**Interfaces:**
- Consumes: `PLAN_GOALS`, `PLAN_GOAL_LABELS`, `PlanGoal` from `@/lib/ai/modules/contentPlan`.
- Produces: `REELS_PERSONA_LABELS: Record<"expert" | "emotional" | "sales", string>` and `reelsInstructions(topic: string, product: string, goal: PlanGoal): string`.

- [ ] **Step 1: Write the failing test** — `src/lib/ai/modules/reels.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { REELS_PERSONA_LABELS, reelsInstructions } from "./reels";

describe("reelsInstructions", () => {
  it("includes topic, product, and goal label", () => {
    const s = reelsInstructions("Yozgi aksiya", "Fitnes abonement", "sales");
    expect(s).toContain("Yozgi aksiya");
    expect(s).toContain("Fitnes abonement");
    expect(s).toContain("sotuvni oshirish");
  });

  it("mentions all 3 personas", () => {
    const s = reelsInstructions("Mavzu", "Mahsulot", "awareness");
    expect(s).toContain("Ekspert");
    expect(s).toContain("Emotsional");
    expect(s).toContain("Sotuv");
  });

  it("is deterministic for identical inputs (cache-safe)", () => {
    expect(reelsInstructions("Mavzu", "Mahsulot", "engagement")).toBe(
      reelsInstructions("Mavzu", "Mahsulot", "engagement")
    );
  });
});

describe("REELS_PERSONA_LABELS", () => {
  it("has Uzbek labels for all 3 personas", () => {
    expect(REELS_PERSONA_LABELS).toEqual({
      expert: "Ekspert",
      emotional: "Emotsional",
      sales: "Sotuv",
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ai/modules/reels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/ai/modules/reels.ts`:

```ts
import { PLAN_GOALS, type PlanGoal } from "@/lib/ai/modules/contentPlan";

export const REELS_PERSONA_LABELS: Record<"expert" | "emotional" | "sales", string> = {
  expert: "Ekspert",
  emotional: "Emotsional",
  sales: "Sotuv",
};

export function reelsInstructions(topic: string, product: string, goal: PlanGoal): string {
  return `# Vazifa: Reels ssenariysi
Mavzu: ${topic}
Mahsulot/xizmat: ${product}
Asosiy maqsad: ${PLAN_GOALS[goal]}

Aynan 3 ta ssenariy yozing — har biri boshqa uslubda:
1. Ekspert — bilim va ishonchga asoslangan uslub
2. Emotsional — his-tuyg'u va hikoyaga asoslangan uslub
3. Sotuv — to‘g‘ridan-to‘g‘ri taklif va CTA'ga asoslangan uslub

Har bir ssenariy uchun:
- Hook: birinchi 3 soniyada e'tiborni tortadigan jumla
- Sahnalar: kadr-bakadr ro‘yxat (har birida vaqt oralig‘i va nima ko‘rsatilishi)
- Ovoz matni (voiceover): to‘liq matn
- Caption: post uchun izoh
- CTA: harakatga chaqiruv
- Davomiylik: tavsiya etilgan vaqt (masalan, "15–20 soniya")

Barchasi o‘zbek (lotin) tilida, brend ohangiga mos bo‘lsin.`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/ai/modules/reels.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/modules/reels.ts src/lib/ai/modules/reels.test.ts
git commit -m "feat: add reels module instructions and persona labels"
```

---

### Task 3: Generate API route

**Files:**
- Create: `src/app/api/generate/reels/route.ts`

**Interfaces:**
- Consumes: `runStructuredGeneration` from `@/lib/ai/engine`, `ReelsSchema` from `@/lib/ai/schemas` (Task 1), `reelsInstructions` from `@/lib/ai/modules/reels` (Task 2), `PLAN_GOALS` from `@/lib/ai/modules/contentPlan`, `buildBrandContext` from `@/lib/ai/prompts`, `getOrCreateWorkspace`, `createClient`.
- Produces: `POST /api/generate/reels` accepting `{ brandId, topic, product, goal }`, returning `{ ok: true, data: ReelsOutput, creditsLeft }` or `{ ok: false, error }`.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { ReelsSchema } from "@/lib/ai/schemas";
import { buildBrandContext } from "@/lib/ai/prompts";
import { reelsInstructions } from "@/lib/ai/modules/reels";
import { PLAN_GOALS, type PlanGoal } from "@/lib/ai/modules/contentPlan";
import type { Brand } from "@/lib/types";

export async function POST(req: Request) {
  const { brandId, topic, product, goal } = await req.json();

  if (!(goal in PLAN_GOALS)) {
    return NextResponse.json({ ok: false, error: "Noto‘g‘ri maqsad." }, { status: 400 });
  }
  if (!topic || String(topic).trim().length < 3) {
    return NextResponse.json({ ok: false, error: "Mavzuni kiriting." }, { status: 400 });
  }
  if (!product || String(product).trim().length < 3) {
    return NextResponse.json(
      { ok: false, error: "Mahsulot yoki xizmatni kiriting." },
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
    module: "reels",
    brandContext: buildBrandContext(brand as Brand),
    moduleInstructions: reelsInstructions(String(topic), String(product), goal as PlanGoal),
    userInput: "Mavzu: " + String(topic) + " | Mahsulot/xizmat: " + String(product),
    inputRecord: { brandId, topic, product, goal },
    schema: ReelsSchema,
    maxTokens: 4096,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run build` — Expected: compiles, route listed as `ƒ /api/generate/reels`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/reels/route.ts
git commit -m "feat: add reels generation API route"
```

---

### Task 4: Sidebar entry + Reels page + form

**Files:**
- Modify: `src/components/app/Sidebar.tsx` (icon import + `NAV` array)
- Create: `src/app/app/reels/page.tsx`
- Create: `src/app/app/reels/ReelsForm.tsx`

**Interfaces:**
- Consumes: `POST /api/generate/reels` (Task 3), `REELS_PERSONA_LABELS` (Task 2), `PLAN_GOAL_LABELS`/`PlanGoal` from `@/lib/ai/modules/contentPlan`, `ReelsVariant` type from `@/lib/ai/schemas`, `GeneratingCard`, `Card`, `Button`, `Select`/`Textarea`/`Label` from `@/components/ui/`.
- Produces: `/app/reels` page; sidebar nav gains a "Reels" entry after "Kopiraiting".

- [ ] **Step 1: Add the nav entry** — in `src/components/app/Sidebar.tsx`, change the lucide import to include `Clapperboard`:

```ts
import { Home, Briefcase, CalendarDays, PenLine, Clapperboard, LogOut } from "lucide-react";
```

and append to `NAV` after the Kopiraiting entry:

```ts
  { href: "/app/reels", label: "Reels", icon: Clapperboard, exact: false },
```

- [ ] **Step 2: Create the server page** — `src/app/app/reels/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import ReelsForm from "./ReelsForm";
import Link from "next/link";

export default async function ReelsPage() {
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
      <h1 className="font-display text-2xl font-semibold text-ink">Reels</h1>
      {brands.length === 0 ? (
        <p className="text-muted">
          Avval brend qo‘shing —{" "}
          <Link className="font-medium text-accent hover:underline" href="/app/brands/new">
            yangi brend yaratish
          </Link>
        </p>
      ) : (
        <ReelsForm brands={brands} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the client form** — `src/app/app/reels/ReelsForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { PLAN_GOAL_LABELS, type PlanGoal } from "@/lib/ai/modules/contentPlan";
import { REELS_PERSONA_LABELS } from "@/lib/ai/modules/reels";
import type { ReelsVariant } from "@/lib/ai/schemas";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Input";
import GeneratingCard from "@/components/ai/GeneratingCard";

const REELS_STATUS_MESSAGES = [
  "Brendni o‘rganmoqda…",
  "Hook yozilmoqda…",
  "Sahnalar tuzilmoqda…",
  "Ovoz matni yozilmoqda…",
  "Caption va CTA tayyorlanmoqda…",
  "Sayqallanmoqda…",
];

const PERSONA_ORDER: ReelsVariant["persona"][] = ["expert", "emotional", "sales"];

type BrandOption = { id: string; name: string };

function assembleScript(v: ReelsVariant): string {
  return [
    `Hook: ${v.hook}`,
    "",
    "Sahnalar:",
    ...v.scenes.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Ovoz matni: ${v.voiceover}`,
    "",
    `Caption: ${v.caption}`,
    `CTA: ${v.cta}`,
    `Davomiylik: ${v.duration}`,
  ].join("\n");
}

export default function ReelsForm({ brands }: { brands: BrandOption[] }) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [product, setProduct] = useState("");
  const [goal, setGoal] = useState<PlanGoal>("engagement");
  const [variants, setVariants] = useState<ReelsVariant[]>([]);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setVariants([]);
    try {
      const res = await fetch("/api/generate/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, topic, product, goal }),
      });
      const json = await res.json();
      if (json.ok) {
        const sorted = [...json.data.variants].sort(
          (a, b) => PERSONA_ORDER.indexOf(a.persona) - PERSONA_ORDER.indexOf(b.persona)
        );
        setVariants(sorted);
        setCreditsLeft(json.creditsLeft);
      } else {
        setError(json.error ?? "Xatolik yuz berdi.");
      }
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  async function copyVariant(v: ReelsVariant) {
    await navigator.clipboard.writeText(assembleScript(v));
    setCopied(v.persona);
    setTimeout(() => setCopied(null), 1500);
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
        <label className="block">
          <Label>Mavzu</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            placeholder="Masalan: Yozgi aksiya"
          />
        </label>
        <label className="block">
          <Label>Mahsulot/xizmat</Label>
          <Textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            rows={2}
            placeholder="Masalan: Fitnes abonementi"
          />
        </label>
        <label className="block">
          <Label>Maqsad</Label>
          <Select value={goal} onChange={(e) => setGoal(e.target.value as PlanGoal)}>
            {Object.entries(PLAN_GOAL_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleGenerate}
          disabled={
            loading ||
            !brandId ||
            topic.trim().length < 3 ||
            product.trim().length < 3
          }
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (3 kredit)"}
        </Button>
        {creditsLeft !== null && (
          <p className="text-sm text-muted">Qolgan kreditlar: {creditsLeft}</p>
        )}
      </Card>

      <GeneratingCard active={loading} messages={REELS_STATUS_MESSAGES} />

      {variants.map((v) => (
        <Card key={v.persona} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              {REELS_PERSONA_LABELS[v.persona]}
            </span>
            <button
              onClick={() => copyVariant(v)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {copied === v.persona ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
          <p className="text-sm font-medium text-ink">{v.hook}</p>
          <div>
            <p className="text-sm font-medium text-muted">Sahnalar</p>
            <ol className="ml-4 list-decimal space-y-1 text-sm text-ink">
              {v.scenes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <p className="text-sm text-ink">
            <span className="font-medium text-muted">Ovoz matni: </span>
            {v.voiceover}
          </p>
          <p className="text-sm text-ink">
            <span className="font-medium text-muted">Caption: </span>
            {v.caption}
          </p>
          <p className="text-sm text-ink">
            <span className="font-medium text-muted">CTA: </span>
            {v.cta}
          </p>
          <p className="text-sm text-muted">Davomiylik: {v.duration}</p>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: clean.
Run: `npm run build` — Expected: compiles, lists `ƒ /app/reels`.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/Sidebar.tsx src/app/app/reels/
git commit -m "feat: add reels generator page with sidebar entry"
```

---

### Task 5: Manual end-to-end verification

- [ ] **Step 1: Start dev server** — `npm run dev`, log in.
- [ ] **Step 2: Generate** — Reels → pick a real brand → Mavzu "Yozgi aksiya", Mahsulot/xizmat "Fitnes abonementi", Maqsad "Sotuv" → Generatsiya qilish. Progress card rotates; after completion, 3 cards render in order Ekspert, Emotsional, Sotuv, each with a Hook, numbered Sahnalar, Ovoz matni, Caption, CTA, Davomiylik — all Uzbek (Latin).
- [ ] **Step 3: Ledger + audit** — in Supabase: `credit_ledger` has a −3 `generation` row; `generations` has a `reels` row with token counts and `credits_spent=3`.
- [ ] **Step 4: Copy-to-clipboard** — click "Nusxalash" on one card, paste into a text field, confirm it contains the hook, numbered scenes, voiceover, caption, CTA, and duration in readable form; button shows "Nusxalandi ✓" briefly.
- [ ] **Step 5: Validation + errors** — submit with topic/product under 3 chars → button stays disabled; a second run with insufficient credits (if reachable) shows the engine's Uzbek credit-shortfall message via the error banner.
- [ ] **Step 6: Gates** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean.
- [ ] **Step 7: Commit anything outstanding.**

---

## Self-Review Notes

- **Spec coverage:** §2 schema (exact 3 personas, scenes non-empty) → Task 1; §3 module (goal reuse, persona labels, instructions) → Task 2; §4 route → Task 3; §5 UI (sidebar, form, persona-ordered cards, copy-to-clipboard) → Task 4; §6 testing → Tasks 1–2 (unit) and Task 5 (manual E2E); §7 error handling → engine's existing Uzbek errors reused in Task 3/4, no brand → existing prompt pattern in Task 4 Step 2.
- **Out of scope honored:** no new table, no list/detail pages, no per-variant regeneration, no video rendering.
- **Type consistency check:** `ReelsVariant`/`ReelsOutput`/`ReelsPersona` (Task 1) ↔ `REELS_PERSONA_LABELS` keys (Task 2) ↔ route's `schema: ReelsSchema` (Task 3) ↔ `ReelsForm`'s `PERSONA_ORDER`/`assembleScript` (Task 4) all agree on the `persona` field name and its 3 values.
- **No new dependency:** reuses `runStructuredGeneration`, `buildBrandContext`, `PLAN_GOALS`/`PLAN_GOAL_LABELS`, `GeneratingCard`, and existing UI primitives — nothing to install.
