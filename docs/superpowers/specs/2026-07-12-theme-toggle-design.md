# Light/Dark/System theme toggle

**Date:** 2026-07-12
**Status:** Approved

## Problem

The app already supports dark mode, but only via `prefers-color-scheme` in `src/app/globals.css` — it silently follows the OS setting with no way for a user to override it. We want an explicit Light / Dark / System toggle available everywhere: the public landing page, login/signup, and the authenticated app shell.

## Design

### 1. CSS overrides (`src/app/globals.css`)

Keep the existing `@media (prefers-color-scheme: dark)` block (it remains the behavior for "System" / no explicit choice). Add two new blocks with the same color values, keyed off an explicit `data-theme` attribute on `<html>`:

```css
:root[data-theme="dark"] {
  /* same values as the existing prefers-color-scheme: dark block */
}
:root[data-theme="light"] {
  /* same values as the default :root block */
}
```

Precedence: `:root[data-theme="dark"]` / `:root[data-theme="light"]` are plain selectors that come after the media query in source order and match unconditionally once the attribute is present, so they win over `prefers-color-scheme` regardless of OS setting. When `data-theme` is absent (fresh visit, no stored preference) or explicitly `"system"`, no override selector matches and `prefers-color-scheme` decides, unchanged from today.

### 2. Persistence + no-flash boot

- Preference stored in `localStorage` under key `theme`, value `"light" | "dark" | "system"`.
- An inline `<script>` placed in `<head>` in `src/app/layout.tsx`, before the stylesheet-dependent content renders, synchronously reads `localStorage.theme` and sets `document.documentElement.dataset.theme` accordingly (skipping the call entirely — leaving the attribute unset — when the value is `"system"` or missing). This runs before first paint, so there's no flash of the wrong theme. It must be a plain inline script (not a Next.js-hydrated component), since a `useEffect` would run after first paint.
- No cookie/server-side involvement — theme is a client-only presentation preference, not tenant data, so `localStorage` is sufficient and avoids SSR/client mismatch complexity.

### 3. `ThemeToggle` component (`src/components/ui/ThemeToggle.tsx`)

- Client component (`"use client"`), self-contained — no React context/provider.
- Only one instance is ever mounted at a time (Sidebar on `/app/*`, OR landing header, OR auth panel — never more than one on screen at once), so component-local state that reads `localStorage` on mount and writes to it + `document.documentElement.dataset.theme` on change is sufficient; no cross-component sync needed.
- UI: a 3-segment icon control using `lucide-react` (`Sun`, `Moon`, `Monitor`), styled consistently with the Sidebar's existing active-nav-item treatment (`bg-accent-soft text-accent` for the active segment, `text-muted hover:text-ink` for inactive).
- On mount, reads `localStorage.theme` (defaulting to `"system"` if unset) to determine which segment shows as active — no separate "did the OS override win" detection needed, since "system" is just the absence of an override.

### 4. Placement

- **Sidebar** (`src/components/app/Sidebar.tsx`): add next to/above the sign-out button in the bottom section, visible in both the icon-only mobile bar and the expanded desktop rail.
- **Landing page** (`src/app/page.tsx`): in the header `<nav>`, alongside "Kirish" / "Bepul boshlash".
- **Auth pages** (`src/components/auth/AuthSplitLayout.tsx`): added once in the shared layout (top-right corner of the form panel), so both `/login` and `/signup` get it automatically without per-page changes.

### 5. Out of scope

- No server-side/cookie-based theme (no SSR-rendered theme-correct HTML on first request from a new device — acceptable, since the inline script eliminates flash on the client regardless).
- No multi-tenant/workspace-level theme setting — this is a per-browser user preference only.

## Testing

- Manual verification (per project convention, no automated test framework covers visual/CSS behavior): toggle through Light/Dark/System on the landing page, login, signup, and `/app`, confirm the choice persists across a full page reload and across navigating between these page groups, and confirm no flash-of-wrong-theme on reload with a non-default explicit choice set.
