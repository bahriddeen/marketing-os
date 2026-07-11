# Frontend Redesign — Design Spec

**Date:** 2026-07-12
**Status:** Approved — ready for implementation plan

---

## 1. Context & Goal

The current frontend is the unmodified `create-next-app` starter styled with raw Tailwind utility defaults: black/white buttons, `bg-gray-50`, no type system, no icons, no landing page (`/` redirects straight into `/app`). The founder wants a modern, distinctive, "Apple-like precision" visual identity across the whole product — not a copy of Apple's or Claude's actual marks, but that quality bar: confident, spacious, quietly premium, easy to use.

**Scope:** full frontend restyle — new landing page, login, signup, app shell (sidebar/nav), dashboard home, brands list, brand form (new/edit), copywriting generator. One shared design-token system and a small set of UI primitives underneath all of it, so pages stay consistent rather than each reinventing styles.

**Out of scope:** no backend/data-model changes, no new product functionality, no changes to routing structure beyond adding the `/` landing page content (currently a redirect).

**Language:** all UI copy stays Uzbek (Latin) only — no Russian, no English strings in the shipped UI (see founder decision on file). Existing Uzbek copy in current pages should be preserved or improved, never translated away.

## 2. Design Tokens

### 2.1 Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | `#FAFAF8` | `#101214` | page background |
| `--surface` | `#FFFFFF` | `#17191C` | cards, panels, inputs |
| `--ink` | `#14171B` | `#F2F1ED` | primary text, headings |
| `--muted` | `#6B7280` | `#9AA0A6` | secondary text, placeholders |
| `--line` | `#E6E4DF` | `#2A2D30` | hairline borders, dividers |
| `--accent` | `#146B4F` | `#2FA679` | primary actions, links, focus rings, active nav state |
| `--accent-hover` | `#0F5A41` | `#3DBF8C` | hover/active state of accent surfaces |
| `--accent-soft` | `#E3F3EA` | `#173A2C` | badges, success states, subtle highlight backgrounds |
| `--danger` | `#B3261E` | `#F2867B` | error text, destructive actions |

Dark mode activates via `prefers-color-scheme: dark` (no manual toggle in this pass — out of scope, can be added later without changing the token system).

### 2.2 Type

| Role | Face | Weight/usage |
|---|---|---|
| Display | Instrument Sans (`next/font/google`) | Semibold/Bold, tight tracking (`-0.02em`). Headlines, page titles, logo wordmark only. |
| Body | Inter (`next/font/google`) | Regular/Medium. Paragraphs, labels, buttons, nav, form text. |
| Utility/mono | JetBrains Mono (`next/font/google`) | Regular. Credit balance numbers, small eyebrow labels, timestamps. |

Type scale (rem, applied via Tailwind theme extension):
- Display XL: 3.5rem / 1.05 — landing hero headline
- Display L: 2.25rem / 1.1 — page titles (dashboard, brands, copy)
- Display M: 1.5rem / 1.2 — section/card headings
- Body: 1rem / 1.6 — paragraphs
- Small: 0.875rem / 1.5 — secondary text, form hints
- Mono: 0.875rem, `font-variant-numeric: tabular-nums` — credit numbers

### 2.3 Layout & primitives

Shared primitives (new, under `src/components/ui/`):
- `Button` — variants: primary (accent fill), secondary (bordered), ghost (text-only, destructive uses `--danger`). Consistent padding, radius (`0.625rem`), focus-visible ring, subtle scale-on-hover (98%→100%, 150ms).
- `Input` — consistent border, focus ring in accent color, error state (red border + inline message below, not a toast).
- `Card` — surface bg, `--line` border, `0.75rem` radius, soft shadow (`0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)`).

Radius scale: inputs/buttons `0.625rem`, cards `0.75rem`, avatars/icons circular. No sharp corners (this is not the broadsheet/hairline direction).

Icons: `lucide-react` (new dependency) for sidebar nav, empty states, and inline affordances. Stroke width 1.75, sized 18–20px inline with text.

## 3. Page-by-page

### 3.1 Landing page (`/`)

Currently `redirect("/app")`. Becomes a real public page:
- Minimal top nav: wordmark (Instrument Sans) + "Kirish" (login link) + "Bepul boshlash" (primary button → signup). No hamburger/mobile menu needed — two links fit at all widths.
- Hero: Display XL headline stating the real value prop (brand info → ready-to-post content), one-sentence subhead, single primary CTA to signup. No secondary "watch demo" CTA — one clear action.
- **Signature element:** a card styled like the real copywriting generator UI, showing a real Uzbek Instagram caption typing itself out character-by-character on mount, settling with a small checkmark + "Tayyor" label. One-time animation on load (`IntersectionObserver` or mount-triggered), not looping. Respects `prefers-reduced-motion: reduce` — renders the finished caption immediately, no animation, if set.
- Below the fold: 4 sections, one per MVP module (Brand Knowledge Base, Content Planner, Reels Generator, Copywriting) — each framed by the outcome it produces, using real module language from the product, not generic feature-list copy ("Streamline your workflow" style is explicitly avoided).
- Simple footer: wordmark, copyright, no link farm (product has no blog/pricing/docs pages yet — don't fabricate links to pages that don't exist).

### 3.2 Login & signup (`/login`, `/signup`)

Split-screen on `md:` and up, single column on mobile:
- Left panel (hidden below `md:`): quieter restatement of the same live-caption signature, on `--ink` dark surface regardless of light/dark mode (consistent brand panel), so it reads as one continuous idea with the landing hero without competing with the form.
- Right panel: centered form, `max-w-sm`, wordmark above the heading, Uzbek heading ("Kirish" / "Ro'yxatdan o'tish"), `Input` primitives, inline error rendering (existing `searchParams.error` pattern preserved — just restyled, not re-plumbed), primary `Button` full-width, switch-link to the other auth page below.
- Error copy audit: current error handling comes from `src/app/auth/actions.ts` — restyle the error banner (icon + message, `--danger` tones) but do not change the error strings/logic unless they're empty/placeholder (verify during implementation).

### 3.3 App shell (`src/app/app/layout.tsx`)

- Sidebar: wordmark at top, nav items with `lucide-react` icons (Bosh sahifa → home icon, Brendlar → briefcase/tag icon, Kopiraiting → pen/sparkle icon), active route gets `--accent-soft` background + `--accent` text via `usePathname` comparison (layout becomes aware of active segment — needs a small client component for the nav list, since the icons/active-state need `"use client"` + `usePathname`; the rest of the layout stays a server component).
- Credit balance: mono tabular numbers, small horizontal usage indicator if a plan limit is known (if not available from `getCreditBalance`, just the number — don't fabricate a limit that doesn't exist in the data model).
- Sign out: ghost button style, de-emphasized, bottom of sidebar.

### 3.4 Dashboard home, brands list, brand form, copy generator

Restyle only, using the shared primitives and tokens — no structural/flow changes:
- Dashboard home: `Card`-free hero-style welcome (matches existing simple layout), `Button` primitives for the two CTAs.
- Brands list: `Card` grid (already close to this shape), empty state rewritten in the interface's voice as an invitation to act (per writing guidance) rather than a flat status line — keep it short, Uzbek.
- Brand form (`NewBrandClient.tsx`, `BrandForm.tsx`): apply `Input`/`Button` primitives to existing fields — no field changes.
- Copy generator (`CopyForm.tsx`): apply primitives; if there's a loading/generating state, use restrained motion (e.g. a subtle pulsing dot or the accent color, not a full-page spinner) consistent with the "generation" motif from the landing signature — but this is a nice-to-have, not required if the existing loading state is minimal.

## 4. Motion

- Landing hero caption: one-time typing animation on mount, `prefers-reduced-motion` respected (see 3.1).
- Buttons/interactive elements: hover/press micro-interactions only (opacity/scale, 150–200ms ease-out).
- Sidebar active-state and route changes: background/color transition only (200ms), no page-transition library.
- No scroll-triggered reveals beyond what's naturally visible on load — the landing page is short enough (4 sections) that scroll-choreography would be over-animating a page this size.

## 5. Accessibility & quality floor

- Keyboard focus visible on all interactive elements (accent-colored focus ring, not the browser default nor `outline: none`).
- Color contrast: body text and button labels checked against AA at their sizes (ink-on-canvas and white-on-accent both pass comfortably given the chosen hex values).
- `prefers-reduced-motion: reduce` disables the typing animation and any hover-scale transforms (fall back to opacity-only or instant state).
- Responsive down to a 360px-wide mobile viewport: landing single-column, auth single-column (decorative panel hidden), sidebar collapses to a top bar with the same nav items (implementation detail decided during build — icons-only or a simple drawer, whichever reads cleaner at that width).

## 6. New dependency

- `lucide-react` — icon set for nav/empty-states/inline affordances. Small, tree-shakeable, no visual-identity conflict (outline icons, not a branded icon language).

## 7. Testing

No new business logic is introduced (pure presentation layer), so no new unit tests are required. Existing tests (`src/lib/ai/engine.test.ts`, etc.) are unaffected and must continue to pass. Manual verification: run the dev server and click through landing → signup → login → dashboard → brands → copy generator, checking each page at mobile and desktop widths, light and dark OS theme.
