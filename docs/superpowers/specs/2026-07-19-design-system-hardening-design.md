# Design system hardening — feedback, loading, and confirmation primitives

## Context

A broad "audit and improve the entire UI/UX" request came in, explicitly excluding the AI Chat module (under active development). The full surface (Brands, Copy, Plan, Reels, Admin, Upgrade, Auth, plus the shared design system) is too large for one spec/plan/implementation cycle, so this is the first of several sub-projects. It targets the shared component layer (`src/components/ui/`) and the two concrete destructive-action gaps found during the audit, on the theory that fixing shared primitives once benefits every later page-level pass instead of repeating fixes N times.

## Audit findings

The existing design tokens and primitives (`src/app/globals.css`, `src/components/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `StatusBadge.tsx`) are already consistent — no raw Tailwind palette colors or stray hex values were found outside two spots (below). The gaps are all in missing states and missing shared components, not in existing-component quality:

1. **No `Modal`/`Dialog`, `Toast`, `Skeleton`, or `EmptyState` component exists anywhere in the codebase** (chat has none either, but chat is out of scope).
2. **`src/app/app/brands/actions.ts` `deleteBrand`** is called from a bare `<form action={deleteBrand}>` submit button in `src/app/app/brands/page.tsx:52` — no confirmation step, no error returned to the caller (a Supabase error is silently swallowed), no pending/loading state. One misclick permanently deletes a brand and everything that depends on it.
3. **`src/app/app/plan/PlansTable.tsx`** already has a working inline confirm-before-delete pattern (click trash icon → "O'chirilsinmi? Ha / Yo'q" — but it's bespoke local state, not reusable, and its errors render only as a plain paragraph rather than a transient toast.
4. **`src/components/auth/AuthSplitLayout.tsx:12`** hardcodes `bg-[#14171B]`, which is exactly the value of the `--ink` token — should reference `bg-ink` instead so it stays in sync if the token ever changes.
5. **`src/app/app/brands/page.tsx:33`** uses the HTML entity `&apos;` (renders as a straight `'`) inside `ma&apos;lumotlar`, inconsistent with the literal `‘` (U+2018) used elsewhere in the same paragraph and mandated by the project's Uzbek-copy convention.
6. Empty states exist but are hand-rolled per page (`brands/page.tsx`, `plan/page.tsx`) with duplicated markup.
7. Loading states are ad hoc (`isPending`/`isLoading` booleans swapping button text to `"…"` in ~7 files) with no shared skeleton primitive for page/table-level loading.
8. Some icon-only interactive elements (edit/delete icons in `PlansTable.tsx`, pagination arrows) rely only on `aria-label` — need to confirm `focus-visible` ring coverage matches the `Button`/`Input` primitives.

## Goals

- Add four reusable primitives — `Modal` (base), `ConfirmDialog` (built on `Modal`), `Toast` (+ `ToastProvider`/`useToast`), `Skeleton`, `EmptyState` — following the existing primitive conventions (semantic color tokens, `forwardRef` where applicable, colocated in `src/components/ui/`).
- Close the brand-delete data-loss gap: confirm before delete, surface success/error via toast, show a pending state.
- Migrate `PlansTable`'s bespoke confirm to the shared `ConfirmDialog` and add toast feedback, so both delete flows use one pattern.
- Replace the two hand-rolled empty states with `EmptyState`.
- Fix the two small consistency bugs (hardcoded hex, apostrophe entity).
- Verify `focus-visible` styling on icon-only interactive elements; add it where missing.

## Non-goals

- Any change to Chat (`src/app/app/chat/**`, `src/components/chat/**`, `src/app/api/chat/**`).
- Any page-level visual/UX rework of Copy, Reels, Admin, Upgrade, or Auth pages beyond the two fixes in `AuthSplitLayout.tsx` and `brands/page.tsx` called out above. Those pages get their own future sub-project specs.
- A `Tooltip` primitive — no concrete current need surfaced beyond existing `aria-label`s; revisit if a later page-level pass finds one.
- Introducing a toast/dialog library dependency — the app has no such dependency today and the primitives needed are small enough to hand-roll consistent with the existing hand-rolled `ui/` components.
- Changing `runStructuredGeneration`, credit ledger, or any backend/API behavior — this is a frontend-only pass.

## Design

### `Modal` (`src/components/ui/Modal.tsx`)

A minimal, unstyled-except-for-tokens dialog shell: renders via a portal, traps focus while open, closes on `Escape` or backdrop click, restores focus to the trigger element on close, sets `role="dialog"` + `aria-modal="true"`. Takes `open`, `onClose`, and `children`. Not exported for direct page use initially — `ConfirmDialog` is the only consumer, keeping the public surface small until a second consumer needs it.

### `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`)

Props: `open`, `title`, `description`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `variant?: "danger" | "default"`, `pending?: boolean`. Renders on `Modal`, with a `Button variant="danger"` (or `primary`) confirm action that shows a pending state and disables both buttons while `pending` is true, matching the existing disabled/pending convention already used in `PlansTable.tsx`.

### `Toast` (`src/components/ui/Toast.tsx`)

- `ToastProvider`: a client component holding a small list of `{ id, message, tone: "success" | "error" }` in state, rendered as a fixed-position stack (bottom-right on desktop, bottom-full-width on mobile) via portal. Auto-dismiss after ~4s, manual dismiss button, `aria-live="polite"` region so screen readers announce new toasts without stealing focus.
- `useToast()`: returns `{ show: (message: string, tone?: "success" | "error") => void }`.
- Mounted once: `ToastProvider` wraps children in `src/app/app/layout.tsx` (the existing authenticated-app layout that already renders `Sidebar`), not in the root layout — keeps it scoped to `/app/*` where the delete flows live, consistent with how `Sidebar` is already scoped there.

### `Skeleton` (`src/components/ui/Skeleton.tsx`)

A single `<div>` with a pulsing background (`animate-pulse bg-canvas-soft`) and a `className` passthrough for sizing — callers compose shapes (text lines, table rows, cards) by rendering multiple `Skeleton` elements with Tailwind sizing classes, the same compositional approach the codebase already uses for `Card`.

### `EmptyState` (`src/components/ui/EmptyState.tsx`)

Props: `icon?: LucideIcon`, `title`, `description`, `action?: ReactNode`. Centers content in a `Card`-like container. Replaces the duplicated markup in `brands/page.tsx` (lines 29-39) and `plan/page.tsx` (~line 72) with identical visual output — this is a refactor of existing markup into a shared component, not a redesign of the empty state itself.

### Wiring changes

- **`src/app/app/brands/actions.ts`**: `deleteBrand` becomes a normal async function returning `{ ok: true } | { ok: false; error: string }` (matching the existing pattern in `plan/actions.ts`'s `deletePlan`) instead of a bare form action; the delete no longer blindly redirects on Supabase error.
- **`src/app/app/brands/page.tsx`**: brand cards become a small client component (or the delete button extracts into one, e.g. `BrandDeleteButton.tsx`) that opens `ConfirmDialog`, calls the updated `deleteBrand`, and reports the result via `useToast()`.
- **`src/app/app/plan/PlansTable.tsx`**: replace the `confirmId` inline-state UI with `ConfirmDialog`; on `deletePlan` failure, call `useToast().show(res.error, "error")` instead of only rendering the local `error` paragraph (the inline error paragraph can be removed once toast covers it).
- **`src/app/app/layout.tsx`**: wrap children with `ToastProvider`.
- **`src/components/auth/AuthSplitLayout.tsx`**: `bg-[#14171B]` → `bg-ink`.
- **`src/app/app/brands/page.tsx`**: `ma&apos;lumotlar` → `ma‘lumotlar`.

### Accessibility pass

Grep all interactive elements outside `Button`/`Input`/`Link`-wrapped-in-Button for missing `focus-visible` rings (icon-only edit/delete links and pagination arrows in `PlansTable.tsx` were flagged above); add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas` to match the `Button` primitive's existing focus style where missing.

## Testing

- Unit: none of the new primitives have complex logic warranting dedicated test files beyond what's already covered by existing patterns (this codebase's `*.test.ts` files target business logic like `engine.ts`, not UI components) — skip unit tests for the primitives themselves, consistent with existing test coverage patterns in `src/components/`.
- `npm run lint`, `npx tsc --noEmit`, `npm test` must pass.
- Manual verification in-browser (light + dark mode via `ThemeToggle`, mobile width via responsive Sidebar breakpoint): brand delete confirm → cancel → confirm → success toast; brand delete failure path (if reproducible) → error toast; plan delete same flow; both empty states render identically to before; keyboard-only navigation of `ConfirmDialog` (Tab traps focus, Esc closes, Enter/Space activates buttons).
