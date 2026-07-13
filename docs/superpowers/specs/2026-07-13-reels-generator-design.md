# Reels Scenario Generator (Phase 4) — Design

**Date:** 2026-07-13
**Status:** Approved
**Parent spec:** `2026-07-11-ai-marketing-os-design.md` §6.3, roadmap phase 4

## 1. Summary

The Reels Scenario Generator produces three reels scripts per request — Ekspert (Expert), Emotsional (Emotional), and Sotuv (Sales) personas — from a brand's knowledge base plus a topic, product/service, and goal. Each script has a hook, a shot-by-shot scene list, voiceover text, a caption, a CTA, and a suggested duration. Generation is ephemeral like Copywriting: results render once, get logged to `generations` for the audit trail and credit ledger (module `reels`, weight 3 — already defined in `credits.ts`), and are not saved to their own table.

Decisions made during brainstorming:

- **Goal enum:** reuse Content Planner's `PLAN_GOALS`/`PLAN_GOAL_LABELS` (awareness/engagement/sales) rather than inventing a second goal taxonomy.
- **Persistence:** ephemeral, matching Copywriting — no new DB table, no list/detail pages.
- **Scenes shape:** `string[]`, one string per shot (the model naturally folds timing into the text, e.g. "0–3s: mahsulot yaqindan ko‘rsatiladi").
- **Duration:** free-text Uzbek string (e.g. "15–20 soniya"), not an integer — reel length is naturally a range.

## 2. Output schema

`src/lib/ai/schemas.ts` additions:

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

`.length(3)` enforces exactly the three personas the parent spec requires. The model is instructed to include one variant per persona; `persona` lets the UI render a labeled badge per card regardless of the order the model returns them in.

## 3. Module (`src/lib/ai/modules/reels.ts`)

```ts
import { PLAN_GOALS, PLAN_GOAL_LABELS, type PlanGoal } from "@/lib/ai/modules/contentPlan";

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

`PLAN_GOALS`/`PLAN_GOAL_LABELS` and `PlanGoal` are re-exported/imported from `modules/contentPlan.ts` — no duplicate goal vocabulary.

## 4. API route (`src/app/api/generate/reels/route.ts`)

Mirrors `api/generate/copy/route.ts`: validates `brandId`, non-empty `topic` and `product` (min length 3), `goal` against `PLAN_GOALS` keys; loads the brand via RLS; calls `runStructuredGeneration` with `module: "reels"`, `brandContext: buildBrandContext(brand)`, `moduleInstructions: reelsInstructions(topic, product, goal)`, `userInput` describing the request, `schema: ReelsSchema`, `maxTokens: 4096`. Returns `{ ok, data, creditsLeft }` on success, the engine's Uzbek error on failure.

## 5. UI

New sidebar entry "Reels" (`/app/reels`), positioned after "Kopiraiting" in the nav.

- **`/app/reels/page.tsx`** — server page loading the workspace's brands (same pattern as `copy/page.tsx`); shows the "add a brand first" prompt if none exist, otherwise renders `ReelsForm`.
- **`ReelsForm.tsx`** — client component: brand select, Mavzu textarea, Mahsulot/xizmat textarea, Maqsad select (using `PLAN_GOAL_LABELS`), submit button "Generatsiya qilish (3 kredit)" disabled while loading or until required fields are filled, the existing `GeneratingCard` rotating-status indicator during the request. On success, renders 3 `Card`s in persona order (expert, emotional, sales) via `REELS_PERSONA_LABELS`, each showing: persona badge, Hook, a numbered Ssenariy list, Ovoz matni, Caption, CTA, Davomiylik, and a "Nusxalash" button that assembles the variant into one clipboard-friendly text block (hook + scenes + voiceover + caption + CTA + duration, each on its own line/section) and copies it, following the copy-to-clipboard pattern in `CopyForm.tsx`.

All copy Uzbek (Latin) with U+2018 tutuq belgisi; semantic color utilities and `src/components/ui/` primitives only.

## 6. Testing

TDD (vitest):

- `reelsInstructions` — includes topic/product/goal label, deterministic for identical inputs (cache-safe), mentions all 3 personas.
- `ReelsSchema` — accepts a valid 3-variant payload, rejects a payload with only 2 variants, rejects a payload with 4 variants, rejects an invalid persona value.

Route and UI verified manually end-to-end (generate reels for a real brand, confirm 3 persona-labeled cards render, `generations` row logged with `module='reels'` and `credits_spent=3`, ledger −3, copy-to-clipboard works for each variant).

## 7. Error handling

Credit shortfall and Anthropic errors surface via the engine's existing Uzbek `{ ok: false, error }` messages, rendered through the same error-banner pattern as `CopyForm.tsx`. No brand → the existing "add a brand first" prompt.

## 8. Out of scope

Saved/re-openable reels history, editing generated scripts, xlsx/CSV export, per-variant regeneration, video rendering or actual video/audio production (this generates the *script*, not the video).
