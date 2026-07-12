# Landing Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page hero (`src/app/page.tsx`) as a centered, Termius-inspired hero — bold headline, subtext, single CTA, module-icon row, and a large framed "app window" product preview below — using only this codebase's existing design tokens and Uzbek copy.

**Architecture:** Two files change. A new presentational component, `src/components/marketing/HeroPreview.tsx`, renders the framed app-window mockup (static mini sidebar + the existing `CaptionDemo` component reused as the content pane). `src/app/page.tsx`'s hero `<section>` is rewritten from a two-column grid to a centered column that renders the new headline/subtext/CTA/module-row, followed by `<HeroPreview />`. No new state, no new hooks, no data fetching — this is a pure markup/styling change reusing already-tested behavior (`CaptionDemo`'s typing animation and `prefers-reduced-motion` handling are untouched).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4 (semantic tokens from `src/app/globals.css`), `lucide-react` icons.

## Global Constraints

- All UI copy must be Uzbek (Latin script) only — no Russian, no English strings except the product name "AI Marketing OS".
- Apostrophes in literal JSX text use U+2018 (`‘`), matching the rest of this codebase (e.g. `sun‘iy`, `O‘zbek`) — never U+2019, never an HTML entity (`&#39;`/`&apos;`) inside a JS string literal/variable interpolated via `{expr}` (entities only decode inside literal JSX text).
- Never use raw Tailwind palette colors (`bg-gray-500`, `text-red-600`) or hardcoded hex — only the semantic tokens `bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`/`text-accent`, `bg-accent-hover`, `bg-accent-soft`, `text-danger` (or `var(--accent)` etc. inside an arbitrary Tailwind value, which still resolves through the token).
- Reuse `src/components/ui/Button.tsx` for the CTA — no one-off `<button>` markup.
- No fabricated social proof (user counts, star ratings, client logos) anywhere in the hero.
- This codebase has no automated test coverage for JSX/visual output (`vitest.config.ts` only includes `src/**/*.test.ts`, and no `.test.tsx` files exist) — verification for this plan is `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual visual verification via the dev server, per the project's own convention documented in `docs/superpowers/plans/2026-07-12-theme-toggle-design.md`'s Testing section.

---

### Task 1: `HeroPreview` component

**Files:**
- Create: `src/components/marketing/HeroPreview.tsx`

**Interfaces:**
- Consumes: `CaptionDemo` from `./CaptionDemo` (existing, default export, `variant?: "full" | "quiet"` prop, defaults to `"full"` — no changes to that component).
- Produces: `HeroPreview`, a no-props default-export component, for Task 2 to render as `<HeroPreview />`.

- [ ] **Step 1: Write the component**

```tsx
import { BookOpen, Briefcase, Home, PenLine } from "lucide-react";
import CaptionDemo from "./CaptionDemo";

const NAV_ITEMS = [
  { label: "Bosh sahifa", Icon: Home, active: false },
  { label: "Brendlar", Icon: Briefcase, active: false },
  { label: "Kopiraiting", Icon: PenLine, active: true },
];

export default function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-72 bg-[radial-gradient(ellipse_at_top,_var(--accent)_0%,_transparent_60%)] opacity-[0.08]"
      />
      <div className="relative overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
        <div className="flex">
          <div className="hidden w-48 shrink-0 border-r border-line bg-surface p-4 md:block">
            <p className="mb-4 px-2 text-sm font-semibold text-ink">
              AI Marketing OS
            </p>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ label, Icon, active }) => (
                <span
                  key={label}
                  className={`flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2 text-sm font-medium ${
                    active ? "bg-accent-soft text-accent" : "text-muted"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-canvas p-6">
            <CaptionDemo variant="full" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

This is intentionally a static presentational copy of the real sidebar, not a reuse of `src/components/app/Sidebar.tsx` — that component is a client component requiring a `credits` prop and real auth (`signOut` server action), which don't belong on the public marketing page. `NAV_ITEMS` entries are inert `<span>`s, not `<Link>`s.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors/warnings on the new file.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/HeroPreview.tsx
git commit -m "feat: add HeroPreview app-window mockup for landing hero"
```

---

### Task 2: Rewrite the landing hero section

**Files:**
- Modify: `src/app/page.tsx` (full file below — imports, the new `MODULE_ROW` constant, and the hero `<section>` all change; the feature-grid `<section>` and footer are unchanged)

**Interfaces:**
- Consumes: `HeroPreview` (default export, no props) from `@/components/marketing/HeroPreview`, created in Task 1.

- [ ] **Step 1: Replace the file contents**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HeroPreview from "@/components/marketing/HeroPreview";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { BookOpen, Calendar, Clapperboard, PenLine } from "lucide-react";

const MODULES = [
  {
    title: "Brend bilimlar bazasi",
    body: "Kompaniyangiz haqida bir marta yozing — mahsulotlar, auditoriya, ohang. Sun‘iy intellekt keyingi barcha generatsiyalarda shu ma‘lumotni ishlatadi, qayta tushuntirishga hojat yo‘q.",
  },
  {
    title: "Kontent reja",
    body: "Instagram va Telegram uchun oylik kontent rejasini bir necha daqiqada oling — maqsad va formatga mos, tayyor sarlavhalar bilan.",
  },
  {
    title: "Reels generatori",
    body: "Ssenariy, boshlanish jumlasi va ovoz ohangi — reels uchun tayyor g‘oyalar, brendingiz uslubida.",
  },
  {
    title: "Kopiraiting",
    body: "Post, reklama matni yoki SMS — formatga mos, sotuvga yo‘naltirilgan matnlarni soniyalarda yarating.",
  },
];

const MODULE_ROW = [
  { label: "Bilimlar bazasi", Icon: BookOpen },
  { label: "Kontent reja", Icon: Calendar },
  { label: "Reels", Icon: Clapperboard },
  { label: "Kopiraiting", Icon: PenLine },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold text-ink">
          AI Marketing OS
        </span>
        <nav className="flex items-center gap-6">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Kirish
          </Link>
          <Link href="/signup">
            <Button>Bepul boshlash</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="py-16 text-center md:py-24">
          <h1 className="mx-auto max-w-3xl font-display text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[4rem] md:text-[4.5rem]">
            Brendingiz haqida yozing — tayyor kontentni{" "}
            <span className="text-accent">sun‘iy intellekt</span> yozadi.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            O‘zbek marketing va SMM mutaxassislari uchun — brend
            ma‘lumotidan Instagram va Telegram‘ga tayyor post, reels
            ssenariysi va reklama matni.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/signup">
              <Button className="px-6 py-3 text-base">
                Bepul boshlash
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {MODULE_ROW.map(({ label, Icon }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs text-muted"
              >
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </span>
            ))}
          </div>
          <HeroPreview />
        </section>

        <section className="grid gap-8 border-t border-line py-16 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.title}>
              <h2 className="font-display text-xl font-semibold text-ink">
                {m.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted">{m.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <p className="mx-auto max-w-5xl px-6 text-sm text-muted">
          © {new Date().getFullYear()} AI Marketing OS
        </p>
      </footer>
    </div>
  );
}
```

Note the `CaptionDemo` import is gone from this file (it now lives only inside `HeroPreview`), replaced by the `HeroPreview` import and the four `lucide-react` icons used in `MODULE_ROW`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds (this also statically type-checks and catches server/client component boundary issues Next.js cares about).

- [ ] **Step 5: Manual visual verification**

Run: `npm run dev`, open `http://localhost:3000`.

Check:
- Hero renders centered: headline (with "sun‘iy intellekt" in accent green) → subtext → "Bepul boshlash" button → module-icon row → the framed `HeroPreview` app-window mockup, in that order.
- `HeroPreview`'s right pane shows `CaptionDemo`'s typing animation running (a caption typing out, "Tayyor" checkmark appearing when done).
- Toggle the `ThemeToggle` between Light / Dark / System — hero, mini-sidebar, and `CaptionDemo` all re-color correctly with no unstyled/invisible text in either theme.
- Resize to a mobile width (< `md`): the mini-sidebar inside `HeroPreview` hides (`md:block`/`hidden`), the module-icon row wraps instead of overflowing, and the headline/subtext/CTA stay centered and readable.
- With OS "reduce motion" enabled (or via browser devtools' "Emulate CSS prefers-reduced-motion: reduce"), confirm `CaptionDemo` inside `HeroPreview` shows the full caption immediately with no typing animation (existing behavior, unchanged — just confirm it still applies inside the new frame).
- Confirm no Russian/English strings appear anywhere in the changed markup, and no `&#39;`/`&apos;` literal text renders instead of a real apostrophe.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign landing hero as centered Termius-style layout"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (hero copy block, module row, no trust badges) → Task 2. §2 (`HeroPreview` component: chrome bar, mini-sidebar, `CaptionDemo` content pane, glow) → Task 1. §3 (page structure: header/footer/feature-grid unchanged) → Task 2 preserves them verbatim. §4 (out of scope: `AuthSplitLayout`/`ProductDemo` untouched, no fake proof, no forced-dark hero) → satisfied by construction (neither file is touched; hero inherits `bg-canvas` from the page, not a hardcoded dark background). Testing section → Task 2 Step 5.
- **Type consistency:** `HeroPreview` is a no-prop default export in both Task 1 (produced) and Task 2 (consumed as `<HeroPreview />`) — matches. `CaptionDemo`'s `variant` prop type (`"full" | "quiet"`, already defined in the existing component) is used correctly (`variant="full"`).
