# Landing page hero redesign

**Date:** 2026-07-12
**Status:** Approved

## Problem

The landing page hero (`src/app/page.tsx`, top `<section>`) is a plain two-column split: headline+CTA on the left, the `CaptionDemo` card on the right. We want a more premium, higher-impact hero, styled after the reference screenshot from `termius.com` (dark centered hero → bold headline → subtext → single CTA → small icon row → large framed product screenshot below) — but rebuilt entirely with this codebase's own design tokens and copy (Uzbek-only), not Termius's colors, fonts, or claims.

## Design

### 1. Hero copy block (centered column, `src/app/page.tsx`)

Replace the two-column grid with a centered single column, `max-w-2xl` or `max-w-3xl`, `mx-auto`, `text-center`:

- **H1**: two-line headline, bumped up one step from the current `text-[2.5rem] sm:text-[3.5rem]` scale (e.g. `text-[2.75rem] sm:text-[4rem] md:text-[4.5rem]`), `leading-[1.05]`, `tracking-[-0.02em]`, `text-ink`. One phrase within the headline is wrapped in a `<span className="text-accent">` to create the same bold/light weight contrast Termius uses between "Modern" and "SSH Client" (e.g. keep "Brendingiz haqida yozing." in `text-ink`, put the second sentence in `text-accent`).
- **Subtext**: existing copy, centered, `max-w-xl mx-auto`, `text-muted`.
- **CTA**: single primary `Button` ("Bepul boshlash"), centered. Drop the current CTA's inline flex wrapper div in favor of centered block.
- **Channel row**: small muted row directly under the CTA, replacing Termius's OS-icon row. Shows the channels/formats content is generated for — Instagram, Telegram, Reels, Post — as `lucide-react` icon + label pairs, `text-muted`, `text-xs`, low visual weight (this is the direct analog of Termius's platform-icons row, but truthful to what this product actually does).
- **No trust-badge/ratings/logo row** — omitted entirely (no fabricated user counts, star ratings, or client logos).

### 2. Product visual (`src/components/marketing/HeroPreview.tsx`, new)

A framed "app window" card placed below the hero copy block, full width within the page's `max-w-5xl` container:

- Outer wrapper: `bg-surface`, `border border-line`, `rounded-2xl` (or larger, e.g. `rounded-[1.25rem]`), elevated shadow (reuse the shadow already used by `CaptionDemo`'s `variant="full"`: `shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]`).
- Thin chrome bar at the top of the card: three small dots (`bg-line`/`bg-muted`, no traffic-light colors — stay token-based, not red/yellow/green) left-aligned, consistent with a generic "window" affordance rather than copying macOS's specific palette.
- Below the chrome bar, a two-pane mockup of the real dashboard, using the same `bg-canvas`/`bg-surface`/`border-line` tokens as the actual app shell:
  - **Left mini-sidebar** (hidden below `md:`, like the real `Sidebar`): `bg-surface` with a `border-r border-line`, matching the real sidebar's surface treatment. Reimplements just the static visual — product name label + the three real nav items (Bosh sahifa / Brendlar / Kopiraiting with their existing `lucide-react` icons: `Home`, `Briefcase`, `PenLine`), one marked active (`bg-accent-soft text-accent`) the same way `Sidebar.tsx` marks its active route. This is a presentational copy, not a shared component — it doesn't take `credits`/auth props or link anywhere (nav items are inert `<span>`s, not `<Link>`s, since this is a marketing mockup, not real navigation).
  - **Right content pane**: `bg-canvas`, mirroring the real app shell's main-content background. Renders the existing `CaptionDemo` component with `variant="full"` inside it (its `bg-surface` card reads correctly against the `bg-canvas` pane, exactly as it does on the real `/app` pages), at a larger size than it currently renders in the two-column hero.
- Optional subtle backdrop glow behind the whole card: a radial gradient using `var(--accent)` at low opacity via an arbitrary Tailwind value (e.g. `bg-[radial-gradient(ellipse_at_top,_var(--accent)_0%,_transparent_60%)] opacity-[0.08]`) on an absolutely-positioned pseudo-layer behind the card — token-based, not a hardcoded hex, and subtle enough to work in both themes.
- Respect `prefers-reduced-motion` the same way `CaptionDemo`/`ProductDemo` already do (no additional motion introduced by this component beyond what `CaptionDemo` itself already handles).

### 3. Page structure changes (`src/app/page.tsx`)

- Header/nav: unchanged.
- Hero `<section>`: rewritten per §1, drops the `md:grid-cols-2` layout and the direct `<CaptionDemo />` usage (moves into `HeroPreview`).
- `HeroPreview` rendered as its own block directly below the hero copy, still inside the existing `<main className="mx-auto w-full max-w-5xl ...">` wrapper.
- Feature grid section (`MODULES.map(...)`) and footer: unchanged, out of scope.

### 4. Out of scope

- No changes to `AuthSplitLayout.tsx` or `ProductDemo.tsx` (this redesign targets the landing hero only, per the answered scope question).
- No new trust-proof content (numbers, ratings, logos) — deferred until real data exists.
- No dark-forced hero background — the hero stays theme-aware (`bg-canvas` inherited from the page), unlike Termius's fixed-dark page.

## Testing

Manual verification only (no automated coverage for visual/layout changes, per project convention): check the hero at mobile/tablet/desktop breakpoints, in both light and dark theme (including the explicit `ThemeToggle` override, not just OS preference), confirm `CaptionDemo`'s typing animation still respects `prefers-reduced-motion` inside the new `HeroPreview` frame, and confirm no Russian/English strings or apostrophe/HTML-entity regressions in any new Uzbek copy (per the language-constraint gotchas already tracked for this codebase).
