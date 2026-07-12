# Light/Dark/System Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users explicitly pick Light, Dark, or System theme (persisted across visits) on the landing page, login/signup, and the authenticated app shell — on top of the existing OS-driven `prefers-color-scheme` dark mode.

**Architecture:** CSS gets two new `:root[data-theme="..."]` override blocks that outrank `prefers-color-scheme` when present. A blocking inline `<script>` in `<head>` sets `data-theme` from `localStorage` before first paint (no flash). A single reusable client component (`ThemeToggle`) owns all read/write logic and is mounted in exactly one place per page: `Sidebar` (app), the landing header, and `AuthSplitLayout` (login/signup).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline` tokens in `globals.css`), `lucide-react` icons. No component test runner in this repo (vitest is wired to `src/**/*.test.ts` only, no jsdom/testing-library) — verification is `npm run lint`, `npx tsc --noEmit`, and manual browser checks, matching the spec's Testing section.

## Global Constraints

- All UI copy must be Uzbek (Latin script) only — no Russian, no English strings (product name "AI Marketing OS" is the sole exception). Use U+2018 (`'`) for apostrophes, never U+2019 or HTML entities like `&#39;`/`&apos;` inside JS string literals (only literal JSX text may use entities, and this plan doesn't need any).
- Never use raw Tailwind palette classes (`bg-gray-500`, `text-red-600`) or hardcoded hex — use the semantic tokens (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent-soft`, `border-line`, etc.) already defined in `globals.css`.
- Restyle/extend through `src/components/ui/` primitives rather than one-off markup.
- This codebase's Next.js version has breaking changes vs. training data (per `AGENTS.md`) — if anything about `<head>`/script injection behaves unexpectedly, check `node_modules/next/dist/docs/` before assuming standard Next.js behavior.

---

## File Structure

- **Modify** `src/app/globals.css` — add `:root[data-theme="dark"]` and `:root[data-theme="light"]` override blocks.
- **Modify** `src/app/layout.tsx` — add inline no-flash boot script in `<head>`.
- **Create** `src/components/ui/ThemeToggle.tsx` — the 3-segment Light/Dark/System control; owns all `localStorage`/`document.documentElement.dataset.theme` logic.
- **Modify** `src/components/app/Sidebar.tsx` — mount `ThemeToggle` near sign-out.
- **Modify** `src/app/page.tsx` — mount `ThemeToggle` in the landing header nav.
- **Modify** `src/components/auth/AuthSplitLayout.tsx` — mount `ThemeToggle` top-right of the form panel.

---

### Task 1: CSS theme-override blocks

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: the contract every later task depends on — setting `document.documentElement.dataset.theme = "dark" | "light"` forces that theme; setting it to `"system"` or leaving it unset falls back to `prefers-color-scheme`.

- [ ] **Step 1: Add the override blocks**

Open `src/app/globals.css`. It currently has a `:root { ... }` block (light values, the default), a `@theme inline { ... }` block, then `@media (prefers-color-scheme: dark) { :root { ... } }`. Leave all three exactly as they are. Immediately after the `@media (prefers-color-scheme: dark)` block, add:

```css
:root[data-theme="dark"] {
  --canvas: #101214;
  --surface: #17191C;
  --ink: #F2F1ED;
  --muted: #9AA0A6;
  --line: #2A2D30;
  --accent: #2FA679;
  --accent-hover: #3DBF8C;
  --accent-soft: #173A2C;
  --danger: #F2867B;
}

:root[data-theme="light"] {
  --canvas: #FAFAF8;
  --surface: #FFFFFF;
  --ink: #14171B;
  --muted: #6B7280;
  --line: #E6E4DF;
  --accent: #146B4F;
  --accent-hover: #0F5A41;
  --accent-soft: #E3F3EA;
  --danger: #B3261E;
}
```

These values are copied verbatim from the existing default `:root` block (for `light`) and the existing `@media (prefers-color-scheme: dark) :root` block (for `dark`) — do not invent new colors.

- [ ] **Step 2: Verify with lint/build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0, no errors (CSS isn't type-checked or linted by these, but this confirms Step 1 didn't accidentally break a JS/TS file — CSS syntax itself is verified visually in Step 3).

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `http://localhost:3000` in a browser, open DevTools console, and run:
```js
document.documentElement.dataset.theme = "dark"
```
Expected: page immediately switches to dark colors regardless of OS setting. Then run:
```js
document.documentElement.dataset.theme = "light"
```
Expected: page switches to light colors. Then run:
```js
delete document.documentElement.dataset.theme
```
Expected: page reverts to following the OS `prefers-color-scheme` setting.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add data-theme CSS overrides for explicit light/dark"
```

---

### Task 2: No-flash boot script

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: the `data-theme` attribute contract from Task 1.
- Produces: `localStorage.theme` as the source of truth key (`"light" | "dark" | "system"`), read by this script and later written by `ThemeToggle` (Task 3).

- [ ] **Step 1: Add the inline script**

Open `src/app/layout.tsx`. Inside the `<html>` element, add a `<head>` element containing the script, as the first child, before `<body>`:

```tsx
  return (
    <html
      lang="uz"
      className={`${instrumentSans.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink font-sans">
        {children}
      </body>
    </html>
  );
```

This runs before the body paints. It only ever sets `data-theme` to `"light"` or `"dark"` — when the stored value is `"system"` or absent, it does nothing, which is correct: the CSS in Task 1 already falls back to `prefers-color-scheme` when `data-theme` is unset. The `try/catch` guards against `localStorage` being unavailable (private browsing, disabled storage).

- [ ] **Step 2: Verify with lint/build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open the app, in DevTools console run `localStorage.setItem("theme", "dark")`, then hard-reload the page (Cmd+Shift+R). Expected: the page renders in dark theme from the very first frame — no flash of light theme before it switches. Then run `localStorage.setItem("theme", "light")` and hard-reload with OS set to dark mode (toggle OS appearance if needed). Expected: page stays light throughout, no flash.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add no-flash theme boot script"
```

---

### Task 3: `ThemeToggle` component

**Files:**
- Create: `src/components/ui/ThemeToggle.tsx`

**Interfaces:**
- Consumes: `localStorage.theme` / `document.documentElement.dataset.theme` contract from Tasks 1–2.
- Produces: `export default function ThemeToggle(): JSX.Element` — a zero-prop client component. Later tasks (4, 5, 6) import it as `import ThemeToggle from "@/components/ui/ThemeToggle"` and render `<ThemeToggle />` with no props.

- [ ] **Step 1: Write the component**

Create `src/components/ui/ThemeToggle.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Yorug‘ mavzu" },
  { value: "dark", icon: Moon, label: "Tungi mavzu" },
  { value: "system", icon: Monitor, label: "Tizim mavzusi" },
];

function applyTheme(theme: Theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem("theme");
  } else {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function handleSelect(value: Theme) {
    setTheme(value);
    applyTheme(value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Mavzu"
      className="inline-flex items-center gap-0.5 rounded-[0.625rem] border border-line bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => handleSelect(value)}
            className={`flex items-center justify-center rounded-[0.5rem] p-1.5 transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
```

Note: `theme` state defaults to `"system"` and only changes in the `useEffect` if an explicit `"light"`/`"dark"` was stored — this matches the boot script's behavior (Task 2), which also only ever persists explicit choices, never `"system"`.

- [ ] **Step 2: Verify with lint/build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0, no unused-import or type errors.

- [ ] **Step 3: Manual smoke test in isolation**

Temporarily render `<ThemeToggle />` at the top of `src/app/page.tsx` (inside the existing `<header>`, next to the nav) if not already wired by Task 5 — since Task 5 does this permanently, this step can be skipped if Task 5 is done immediately after. Otherwise: run `npm run dev`, temporarily drop `<ThemeToggle />` anywhere in a page, load it in the browser, click each of the three icons, and confirm: (a) the active icon's background highlights correctly, (b) clicking Light/Dark immediately changes the page colors, (c) clicking System reverts to OS-driven colors, (d) reloading the page after picking Dark keeps it dark with no flash. Remove the temporary placement if you added one outside of Task 5's permanent location.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle component"
```

---

### Task 4: Wire into app Sidebar

**Files:**
- Modify: `src/components/app/Sidebar.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from Task 3 (`import ThemeToggle from "@/components/ui/ThemeToggle"`, `<ThemeToggle />`).

- [ ] **Step 1: Add the import and mount point**

In `src/components/app/Sidebar.tsx`, add the import at the top:

```tsx
import ThemeToggle from "@/components/ui/ThemeToggle";
```

In the bottom section (the `<div className="flex items-center gap-3 md:mt-auto ...">` block that currently holds the credits display and sign-out form), add `<ThemeToggle />` before the sign-out `<form>`:

```tsx
      <div className="flex items-center gap-3 md:mt-auto md:flex-col md:items-stretch md:gap-3 md:pt-4">
        <div className="hidden rounded-[0.625rem] bg-canvas px-3 py-2.5 md:block">
          <p className="text-xs text-muted">Kreditlar</p>
          <p className="font-mono text-lg tabular-nums text-ink">{credits}</p>
        </div>
        <span className="font-mono text-sm tabular-nums text-muted md:hidden">
          {credits}
        </span>
        <ThemeToggle />
        <form action={signOut}>
          <Button type="submit" variant="ghost" aria-label="Chiqish" className="gap-2 px-3">
            <LogOut size={18} strokeWidth={1.75} />
            <span className="hidden md:inline">Chiqish</span>
          </Button>
        </form>
      </div>
```

- [ ] **Step 2: Verify with lint/build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, log in (or use an existing session) and open `/app`. Expected: the theme toggle appears in the sidebar (both the icon-only mobile top bar and the expanded desktop rail), doesn't break the existing layout (credits/sign-out still visible and functional), and switching themes there updates the whole `/app` shell including `Sidebar`'s own `bg-surface`/`border-line` colors.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/Sidebar.tsx
git commit -m "feat: add theme toggle to app sidebar"
```

---

### Task 5: Wire into landing page header

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from Task 3.

- [ ] **Step 1: Add the import and mount point**

In `src/app/page.tsx`, add the import:

```tsx
import ThemeToggle from "@/components/ui/ThemeToggle";
```

In the header `<nav>`, add `<ThemeToggle />` before the "Kirish" link:

```tsx
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
```

- [ ] **Step 2: Verify with lint/build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `http://localhost:3000` (logged out), confirm the toggle appears in the header without breaking the existing nav layout at both mobile and desktop widths, and that switching themes updates the whole landing page including `CaptionDemo` and the module cards further down.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add theme toggle to landing page header"
```

---

### Task 6: Wire into auth pages

**Files:**
- Modify: `src/components/auth/AuthSplitLayout.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from Task 3.

- [ ] **Step 1: Add the import and mount point**

In `src/components/auth/AuthSplitLayout.tsx`, add the import:

```tsx
import ThemeToggle from "@/components/ui/ThemeToggle";
```

Wrap the right-hand form panel in a `relative` container and position the toggle top-right, so it doesn't disturb the existing centered-children layout:

```tsx
      <div className="relative flex w-full flex-col items-center justify-center bg-canvas px-6 py-12 md:w-1/2">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        {children}
      </div>
```

This only changes the right panel (`bg-canvas`, shared by both light/dark) — the left brand panel intentionally keeps its hardcoded `bg-[#14171B]`/`text-white` styling in both themes and is left untouched.

- [ ] **Step 2: Verify with lint/build**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `/login` and `/signup`. Expected: toggle appears top-right of the form panel on both pages, doesn't overlap the form fields at narrow widths (mobile, where the left brand panel is hidden per `md:flex`), and switching themes updates the form panel's colors while the left brand panel stays visually unchanged (by design).

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/AuthSplitLayout.tsx
git commit -m "feat: add theme toggle to auth pages"
```

---

## Final Verification

- [ ] Run the full check suite once more: `npx tsc --noEmit && npm run lint && npm test`
- [ ] Manually walk through: landing → login → signup → app, toggling Light/Dark/System on each, confirming the choice persists across navigation and full reloads, and that there's no flash-of-wrong-theme on reload when an explicit choice is set.
