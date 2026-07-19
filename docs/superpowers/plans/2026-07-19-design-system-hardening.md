# Design System Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing shared UI primitives (Modal/ConfirmDialog, Toast, Skeleton, EmptyState) to `src/components/ui/`, close the brand-delete confirmation gap, and fix two small Uzbek-copy/token consistency bugs — all outside the Chat module.

**Architecture:** Five new client-side primitives colocated in `src/components/ui/` following the existing forwardRef/className-passthrough/semantic-token conventions already used by `Button`, `Input`, `Card`, `StatusBadge`. `ToastProvider` mounts once in the authenticated `/app` layout. `ConfirmDialog` (built on a generic `Modal`) and `useToast()` are then wired into the two existing delete flows (`brands`, `plan`), replacing a bare unconfirmed form submit and a bespoke inline-confirm pattern respectively with one consistent pattern.

**Tech Stack:** Next.js 16 App Router (React 19), TypeScript, Tailwind CSS v4 (semantic tokens via `@theme inline`), `lucide-react` for icons, Supabase (`@supabase/ssr`) for the delete server actions. No new dependencies.

## Global Constraints

- All UI copy must be Uzbek (Latin script) only — no Russian, no English strings except the product name.
- Use the codebase's apostrophe convention: literal `‘` (U+2018), never `’` (U+2019), never HTML entities (`&apos;`/`&#39;`) inside JS string literals or `{expr}`-interpolated text.
- Never use raw Tailwind palette colors (`bg-gray-500`, `text-red-600`) or hardcoded hex — use the semantic tokens (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, `border-line`, `text-danger`, etc.) already defined in `src/app/globals.css`.
- Next.js 16: route `params`/`searchParams` are Promises — `await` them (not touched by this plan, but don't regress existing awaits).
- Do not modify anything under `src/app/app/chat/**`, `src/components/chat/**`, or `src/app/api/chat/**`.
- No new npm dependencies — hand-roll primitives consistent with the existing hand-rolled `ui/` components.
- `npm run lint` and `npx tsc --noEmit` must pass after every task; this repo does not unit-test UI components or `actions.ts` server actions (see existing `src/**/*.test.ts` — all target `src/lib/`), so verification for UI-facing tasks in this plan is a manual browser check, not a new automated test — consistent with the approved spec's Testing section.

---

## File Structure

- Create `src/components/ui/Modal.tsx` — generic accessible dialog shell (focus trap, Esc, backdrop click, portal to `document.body`). Not exported for direct page use yet — only `ConfirmDialog` consumes it.
- Create `src/components/ui/ConfirmDialog.tsx` — confirm/cancel dialog built on `Modal`, used by both delete flows.
- Create `src/components/ui/Toast.tsx` — `ToastProvider` + `useToast()` for success/error feedback.
- Create `src/components/ui/Skeleton.tsx` — pulsing block primitive for loading states.
- Create `src/app/app/plan/loading.tsx` and `src/app/app/brands/loading.tsx` — Next.js route loading UI, the first consumers of `Skeleton`.
- Create `src/components/ui/EmptyState.tsx` — icon + title + description + optional action.
- Modify `src/components/auth/AuthSplitLayout.tsx` — hardcoded hex → `bg-ink` token.
- Modify `src/app/app/brands/page.tsx` — apostrophe-entity fix, empty state → `EmptyState`, delete form → `BrandDeleteButton`.
- Modify `src/app/app/brands/actions.ts` — `deleteBrand` returns `{ ok, error? }` instead of blind redirect.
- Create `src/app/app/brands/BrandDeleteButton.tsx` — client component wiring `ConfirmDialog` + `useToast()` to the updated `deleteBrand`.
- Modify `src/app/app/layout.tsx` — mount `ToastProvider`.
- Modify `src/app/app/plan/PlansTable.tsx` — bespoke inline confirm → `ConfirmDialog` + `useToast()`; add missing `focus-visible` rings to icon-only edit/delete links and numbered pagination links.
- Modify `src/app/app/plan/page.tsx` — both empty states → `EmptyState`.

---

### Task 1: Fix two consistency bugs

**Files:**
- Modify: `src/components/auth/AuthSplitLayout.tsx:12`
- Modify: `src/app/app/brands/page.tsx:33`

**Interfaces:** None — isolated copy/token fixes, no new exports.

- [ ] **Step 1: Fix the hardcoded hex in `AuthSplitLayout.tsx`**

In `src/components/auth/AuthSplitLayout.tsx`, line 12 currently reads:

```tsx
      <div className="hidden w-1/2 flex-col justify-between bg-[#14171B] p-12 md:flex">
```

Change to:

```tsx
      <div className="hidden w-1/2 flex-col justify-between bg-ink p-12 md:flex">
```

- [ ] **Step 2: Fix the apostrophe entity in `brands/page.tsx`**

In `src/app/app/brands/page.tsx`, line 33 currently reads:

```tsx
            ma&apos;lumotlar asosida barcha kontentni tayyorlaydi.
```

Change to:

```tsx
            ma‘lumotlar asosida barcha kontentni tayyorlaydi.
```

(That's the U+2018 `‘` character, matching `yo‘q` and `qo‘shing` earlier in the same paragraph — not a straight `'`.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0, no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open `/login` (renders `AuthSplitLayout`) — the dark panel background should look unchanged (it's the same color, just token-referenced now). Open `/app/brands` — the empty-state paragraph (only visible if you have zero brands) should read correctly with a curly apostrophe in "ma‘lumotlar".

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/AuthSplitLayout.tsx src/app/app/brands/page.tsx
git commit -m "fix: use ink token and correct apostrophe glyph"
```

---

### Task 2: `Modal` + `ConfirmDialog` primitives

**Files:**
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `Modal` — default export, props `{ open: boolean; onClose: () => void; children: ReactNode }`. Renders nothing when `open` is false. Not consumed anywhere except `ConfirmDialog` in this plan.
- Produces: `ConfirmDialog` — default export, props `{ open: boolean; title: string; description: string; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; variant?: "danger" | "default"; pending?: boolean }`. `confirmLabel` defaults to `"Ha"`, `cancelLabel` defaults to `"Yo‘q"`, `variant` defaults to `"danger"`, `pending` defaults to `false`. Consumed by `BrandDeleteButton` (Task 6) and `PlansTable` (Task 7).

- [ ] **Step 1: Create `Modal.tsx`**

```tsx
"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Create `ConfirmDialog.tsx`**

```tsx
"use client";
import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Ha",
  cancelLabel = "Yo‘q",
  onConfirm,
  onCancel,
  variant = "danger",
  pending = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "default";
  pending?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0. (No page renders these yet, so there's nothing to browser-check until Task 6/7 wire them in — that's where the manual verification happens.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Modal.tsx src/components/ui/ConfirmDialog.tsx
git commit -m "feat: add Modal and ConfirmDialog primitives"
```

---

### Task 3: `Toast` primitive + mount in app layout

**Files:**
- Create: `src/components/ui/Toast.tsx`
- Modify: `src/app/app/layout.tsx`

**Interfaces:**
- Produces: `ToastProvider` — named export, client component, props `{ children: ReactNode }`.
- Produces: `useToast()` — named export, hook returning `{ show: (message: string, tone?: "success" | "error") => void }`. Throws if called outside `ToastProvider`. Consumed by `BrandDeleteButton` (Task 6) and `PlansTable` (Task 7).

- [ ] **Step 1: Create `Toast.tsx`**

```tsx
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  show: (message: string, tone?: ToastTone) => void;
} | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId++;
      setToasts((items) => [...items, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 md:inset-x-auto md:right-4 md:items-end"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-[0.625rem] border border-line bg-surface p-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]"
              >
                {t.tone === "error" ? (
                  <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                ) : (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />
                )}
                <p className="flex-1 text-ink">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Yopish"
                  className="shrink-0 rounded text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
```

- [ ] **Step 2: Mount `ToastProvider` in the app layout**

Read `src/app/app/layout.tsx` first to confirm it still matches this shape (it should, since no other task in this plan touches it before now):

```tsx
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import Sidebar from "@/components/app/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar credits={credits} />
      <main className="flex-1 bg-canvas p-4 md:p-8">{children}</main>
    </div>
  );
}
```

Replace with:

```tsx
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import Sidebar from "@/components/app/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar credits={credits} />
        <main className="flex-1 bg-canvas p-4 md:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Manual smoke check**

Run `npm run dev`, log in, confirm any `/app/*` page still renders normally (sidebar + content, no layout shift, no console errors from the mounted `ToastProvider`). No toast should be visible yet since nothing calls `show()` until Task 6/7.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Toast.tsx src/app/app/layout.tsx
git commit -m "feat: add Toast primitive and mount ToastProvider in app layout"
```

---

### Task 4: `Skeleton` primitive + route loading states

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/app/app/plan/loading.tsx`
- Create: `src/app/app/brands/loading.tsx`

**Interfaces:**
- Produces: `Skeleton` — default export, props `{ className?: string }`. Renders a single pulsing `div`; callers size/compose via `className`.

- [ ] **Step 1: Create `Skeleton.tsx`**

```tsx
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[0.625rem] bg-canvas-soft ${className}`}
    />
  );
}
```

- [ ] **Step 2: Create `src/app/app/plan/loading.tsx`**

```tsx
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="space-y-3 rounded-[0.625rem] border border-line bg-surface p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/app/brands/loading.tsx`**

```tsx
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Manual check**

Run `npm run dev`. Route-level `loading.tsx` only flashes briefly on fast local data, so throttle: open Chrome DevTools → Network tab → set throttling to "Slow 4G", then navigate to `/app/plan` and `/app/brands` — you should briefly see the pulsing skeleton layout before real content appears. Confirm no layout jump (skeleton dimensions roughly match real content). Remove throttling afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Skeleton.tsx src/app/app/plan/loading.tsx src/app/app/brands/loading.tsx
git commit -m "feat: add Skeleton primitive and route loading states for plan and brands"
```

---

### Task 5: `EmptyState` primitive

**Files:**
- Create: `src/components/ui/EmptyState.tsx`

**Interfaces:**
- Produces: `EmptyState` — default export, props `{ icon?: LucideIcon; title: string; description: string; action?: ReactNode }`. Consumed by `brands/page.tsx` (Task 6) and `plan/page.tsx` (Task 8).

- [ ] **Step 1: Create `EmptyState.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Card from "./Card";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      {Icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={20} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-medium text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/EmptyState.tsx
git commit -m "feat: add EmptyState primitive"
```

---

### Task 6: Brand delete — confirm dialog + toast

**Files:**
- Modify: `src/app/app/brands/actions.ts`
- Create: `src/app/app/brands/BrandDeleteButton.tsx`
- Modify: `src/app/app/brands/page.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 2), `useToast` (Task 3), `EmptyState` (Task 5).
- Modifies: `deleteBrand(brandId: string): Promise<{ ok: true } | { ok: false; error: string }>` — was `deleteBrand(formData: FormData): Promise<void>` (redirect-only). This is a breaking signature change to a function only called from `brands/page.tsx`, which this task also updates.
- Produces: `BrandDeleteButton` — default export, props `{ id: string; name: string }`. Consumed by `brands/page.tsx`.

- [ ] **Step 1: Update `deleteBrand` in `actions.ts` to return a result instead of redirecting**

Read the current file first — it should still match:

```tsx
export async function deleteBrand(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("brands").delete().eq("id", String(formData.get("id")));
  revalidatePath("/app/brands");
  redirect("/app/brands");
}
```

Replace with (matching the existing `deletePlan` pattern in `src/app/app/plan/actions.ts`):

```tsx
export async function deleteBrand(
  brandId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .delete()
    .eq("id", brandId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: "O‘chirib bo‘lmadi. Qayta urinib ko‘ring." };
  }
  if (!data) {
    return { ok: false, error: "Brend topilmadi." };
  }
  revalidatePath("/app/brands");
  return { ok: true };
}
```

`saveBrand` in the same file is untouched. If `redirect` is no longer used anywhere else in the file after this change, remove its now-unused import; `revalidatePath` stays imported (still used by both functions).

- [ ] **Step 2: Create `BrandDeleteButton.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteBrand } from "./actions";

export default function BrandDeleteButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteBrand(id);
      if (res.ok) {
        setOpen(false);
        toast.show("Brend o‘chirildi.", "success");
        router.refresh();
      } else {
        toast.show(res.error, "error");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded font-medium text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        O‘chirish
      </button>
      <ConfirmDialog
        open={open}
        title="Brendni o‘chirish"
        description={`"${name}" brendini o‘chirmoqchimisiz? Bu amalni ortga qaytarib bo‘lmaydi.`}
        confirmLabel="Ha, o‘chirish"
        cancelLabel="Bekor qilish"
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
        pending={pending}
      />
    </>
  );
}
```

- [ ] **Step 3: Wire `BrandDeleteButton` and `EmptyState` into `brands/page.tsx`**

Read the current file first — after Task 1's apostrophe fix it should match:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { deleteBrand } from "./actions";
import type { Brand } from "@/lib/types";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default async function BrandsPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const brands = (data ?? []) as Brand[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Brendlar
        </h1>
        <Link href="/app/brands/new">
          <Button>Yangi brend</Button>
        </Link>
      </div>
      {brands.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">
            Hali brendingiz yo‘q. Birinchi brendni qo‘shing — Sun‘iy intellekt shu
            ma‘lumotlar asosida barcha kontentni tayyorlaydi.
          </p>
          <Link href="/app/brands/new" className="mt-4 inline-block">
            <Button>Birinchi brendni qo‘shish</Button>
          </Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((b) => (
          <Card key={b.id}>
            <h2 className="font-semibold text-ink">{b.name}</h2>
            <p className="text-sm text-muted">{b.industry || "—"}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link
                className="font-medium text-accent hover:underline"
                href={`/app/brands/${b.id}`}
              >
                Tahrirlash
              </Link>
              <form action={deleteBrand}>
                <input type="hidden" name="id" value={b.id} />
                <button className="font-medium text-danger hover:underline">
                  O‘chirish
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

Replace with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import type { Brand } from "@/lib/types";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import BrandDeleteButton from "./BrandDeleteButton";

export default async function BrandsPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const brands = (data ?? []) as Brand[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Brendlar
        </h1>
        <Link href="/app/brands/new">
          <Button>Yangi brend</Button>
        </Link>
      </div>
      {brands.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="Hali brendingiz yo‘q."
          description="Birinchi brendni qo‘shing — Sun‘iy intellekt shu ma‘lumotlar asosida barcha kontentni tayyorlaydi."
          action={
            <Link href="/app/brands/new">
              <Button>Birinchi brendni qo‘shish</Button>
            </Link>
          }
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((b) => (
          <Card key={b.id}>
            <h2 className="font-semibold text-ink">{b.name}</h2>
            <p className="text-sm text-muted">{b.industry || "—"}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link
                className="font-medium text-accent hover:underline"
                href={`/app/brands/${b.id}`}
              >
                Tahrirlash
              </Link>
              <BrandDeleteButton id={b.id} name={b.name} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Manual verification in browser**

Run `npm run dev`, log in, go to `/app/brands`:
1. If you have zero brands, confirm the new `EmptyState` renders with the briefcase icon, correct Uzbek copy, and working "Birinchi brendni qo‘shish" button.
2. Create a throwaway test brand if needed. Click "O‘chirish" on a brand card → a modal should open (not navigate away), with focus landing on "Bekor qilish" first tabbable element. Press `Tab`/`Shift+Tab` — focus should stay trapped inside the dialog. Press `Escape` — dialog closes, brand still present.
3. Click "O‘chirish" again, then click "Ha, o‘chirish" — button should briefly show "…", the dialog should close, a green success toast ("Brend o‘chirildi.") should appear bottom-right (bottom-full-width on a narrow window), and the brand card should disappear from the grid without a full page reload flash.
4. Confirm the toast auto-dismisses after ~4s, and that clicking its `X` dismisses it immediately.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/brands/actions.ts src/app/app/brands/BrandDeleteButton.tsx src/app/app/brands/page.tsx
git commit -m "fix: require confirmation and show toast feedback on brand delete"
```

---

### Task 7: Plan delete — migrate to `ConfirmDialog` + toast, fix focus-visible gaps

**Files:**
- Modify: `src/app/app/plan/PlansTable.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 2), `useToast` (Task 3).
- No change to `PlansTable`'s own exported props (`plans`, `params`, `total`) or to `deletePlan` in `src/app/app/plan/actions.ts` (already returns `{ ok, error? }` — no change needed there).

- [ ] **Step 1: Replace the inline confirm state with `ConfirmDialog` + toast**

Read the current file first (shown in full during the design/audit phase — reproduced here for reference) — it should still match the version at `src/app/app/plan/PlansTable.tsx`. Replace its full contents with:

```tsx
"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  buildPlansQuery,
  pageItems,
  PLAN_PAGE_SIZES,
  type PlansParams,
} from "@/lib/plansTable";
import { deletePlan } from "./actions";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export type PlanRow = {
  id: string;
  title: string;
  period_start: string;
  post_count: number;
  brands: { name: string } | null;
};

export default function PlansTable({
  plans,
  params,
  total,
}: {
  plans: PlanRow[];
  params: PlansParams;
  total: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const from = (params.page - 1) * params.size;
  const last = Math.max(1, Math.ceil(total / params.size));

  function onDelete() {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    startTransition(async () => {
      const res = await deletePlan(id);
      if (res.ok) {
        setConfirmTarget(null);
        toast.show("Plan o‘chirildi.", "success");
        router.refresh();
      } else {
        toast.show(res.error, "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-2.5 font-medium text-muted">Plan</th>
              <th className="hidden px-4 py-2.5 font-medium text-muted md:table-cell">
                Brend
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">
                Postlar
              </th>
              <th className="w-28 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/app/plan/${p.id}`)}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-canvas"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="font-mono text-xs text-muted">
                    {p.period_start.slice(0, 7)}
                  </p>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted md:table-cell">
                  {p.brands?.name ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {p.post_count} ta post
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex items-center gap-3">
                    <Link
                      href={`/app/plan/${p.id}`}
                      aria-label="Tahrirlash"
                      className="rounded text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      onClick={() => setConfirmTarget({ id: p.id, title: p.title })}
                      aria-label="O‘chirish"
                      className="rounded text-muted transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span className="font-mono tabular-nums">
          Natijalar: {from + 1}–{Math.min(from + params.size, total)} / {total}
        </span>
        <div className="flex items-center gap-1">
          {params.page > 1 ? (
            <Link href={`/app/plan${buildPlansQuery(params, { page: params.page - 1 })}`}>
              <Button variant="ghost" className="px-2 py-1.5" aria-label="Oldingi">
                ‹
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" disabled className="px-2 py-1.5" aria-label="Oldingi">
              ‹
            </Button>
          )}
          {pageItems(params.page, last).map((item, i) =>
            item === "…" ? (
              <span key={`e${i}`} className="px-1.5">
                …
              </span>
            ) : item === params.page ? (
              <span
                key={item}
                aria-current="page"
                className="flex h-8 min-w-8 items-center justify-center rounded-[0.625rem] bg-accent px-2 font-medium text-white"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={`/app/plan${buildPlansQuery(params, { page: item })}`}
                className="flex h-8 min-w-8 items-center justify-center rounded-[0.625rem] px-2 text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                {item}
              </Link>
            )
          )}
          {params.page < last ? (
            <Link href={`/app/plan${buildPlansQuery(params, { page: params.page + 1 })}`}>
              <Button variant="ghost" className="px-2 py-1.5" aria-label="Keyingi">
                ›
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" disabled className="px-2 py-1.5" aria-label="Keyingi">
              ›
            </Button>
          )}
          <Select
            value={String(params.size)}
            onChange={(e) =>
              startTransition(() =>
                router.replace(
                  `/app/plan${buildPlansQuery(params, { size: Number(e.target.value), page: 1 })}`
                )
              )
            }
            className="ml-2 w-auto!"
            aria-label="Sahifa hajmi"
          >
            {PLAN_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmTarget}
        title="Planni o‘chirish"
        description={
          confirmTarget
            ? `"${confirmTarget.title}" planini o‘chirmoqchimisiz? Bu amalni ortga qaytarib bo‘lmaydi.`
            : ""
        }
        confirmLabel="Ha, o‘chirish"
        cancelLabel="Bekor qilish"
        onConfirm={onDelete}
        onCancel={() => setConfirmTarget(null)}
        pending={pending}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Run existing test suite**

Run: `npx vitest run src/lib/plansTable.test.ts`
Expected: PASS — this file's helpers (`buildPlansQuery`, `pageItems`, `PLAN_PAGE_SIZES`) are unchanged, only the consuming component moved; confirms the refactor didn't break the import contract.

- [ ] **Step 4: Manual verification in browser**

Run `npm run dev`, go to `/app/plan` with at least one plan:
1. Click the trash icon on a row → `ConfirmDialog` opens (not the old inline "Ha/Yo‘q" text), background click doesn't navigate to the plan (row click is stopped via `stopPropagation`).
2. Tab through the dialog — focus stays trapped; `Escape` closes it.
3. Confirm delete → pending state shows, dialog closes, success toast appears, row disappears via `router.refresh()`.
4. Tab to the Pencil/Trash2 icons and the numbered pagination links using only the keyboard — each should show a visible focus ring (previously only the prev/next arrow `Button`s had one).

- [ ] **Step 5: Commit**

```bash
git add src/app/app/plan/PlansTable.tsx
git commit -m "refactor: migrate plan delete to ConfirmDialog/Toast and add missing focus rings"
```

---

### Task 8: Plan page empty states → `EmptyState`

**Files:**
- Modify: `src/app/app/plan/page.tsx`

**Interfaces:**
- Consumes: `EmptyState` (Task 5).

- [ ] **Step 1: Replace both empty-state `Card` blocks**

Read the current file first — it should still match:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PlansToolbar from "./PlansToolbar";
import PlansTable, { type PlanRow } from "./PlansTable";
import { parsePlansParams, buildPlansQuery } from "@/lib/plansTable";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = parsePlansParams(sp);
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", ws.id)
    .order("name");
  const brands = brandsData ?? [];

  let query = supabase
    .from("content_plans")
    .select("id, title, period_start, post_count, brands(name)", { count: "exact" })
    .eq("workspace_id", ws.id);

  if (p.q) {
    const q = p.q.replace(/[,()]/g, " ").trim();
    if (q) query = query.ilike("title", `%${q}%`);
  }
  if (p.brand) query = query.eq("brand_id", p.brand);
  if (p.platform) query = query.eq("platform", p.platform);

  const from = (p.page - 1) * p.size;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + p.size - 1);
  const plans = (data ?? []) as unknown as PlanRow[];
  const total = count ?? 0;
  const hasFilters = !!p.q || !!p.brand || !!p.platform;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Kontent-plan
        </h1>
        <Link href="/app/plan/new">
          <Button>Yangi plan</Button>
        </Link>
      </div>

      {total === 0 && !hasFilters ? (
        <Card className="text-center">
          <p className="text-muted">
            Hali kontent-planingiz yo‘q. Brend tanlang — sun‘iy intellekt bir
            oylik plan tuzib beradi.
          </p>
          <Link href="/app/plan/new" className="mt-4 inline-block">
            <Button>Birinchi planni yaratish</Button>
          </Link>
        </Card>
      ) : (
        <>
          <PlansToolbar brands={brands} params={p} />
          {plans.length === 0 ? (
            <Card className="text-center">
              <p className="text-muted">Hech narsa topilmadi.</p>
              <Link href="/app/plan" className="mt-4 inline-block">
                <Button variant="ghost">Filtrlarni tozalash</Button>
              </Link>
            </Card>
          ) : (
            <PlansTable key={buildPlansQuery(p) || "default"} plans={plans} params={p} total={total} />
          )}
        </>
      )}
    </div>
  );
}
```

Replace with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PlansToolbar from "./PlansToolbar";
import PlansTable, { type PlanRow } from "./PlansTable";
import { parsePlansParams, buildPlansQuery } from "@/lib/plansTable";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = parsePlansParams(sp);
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", ws.id)
    .order("name");
  const brands = brandsData ?? [];

  let query = supabase
    .from("content_plans")
    .select("id, title, period_start, post_count, brands(name)", { count: "exact" })
    .eq("workspace_id", ws.id);

  if (p.q) {
    const q = p.q.replace(/[,()]/g, " ").trim();
    if (q) query = query.ilike("title", `%${q}%`);
  }
  if (p.brand) query = query.eq("brand_id", p.brand);
  if (p.platform) query = query.eq("platform", p.platform);

  const from = (p.page - 1) * p.size;
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + p.size - 1);
  const plans = (data ?? []) as unknown as PlanRow[];
  const total = count ?? 0;
  const hasFilters = !!p.q || !!p.brand || !!p.platform;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Kontent-plan
        </h1>
        <Link href="/app/plan/new">
          <Button>Yangi plan</Button>
        </Link>
      </div>

      {total === 0 && !hasFilters ? (
        <EmptyState
          icon={CalendarDays}
          title="Hali kontent-planingiz yo‘q."
          description="Brend tanlang — sun‘iy intellekt bir oylik plan tuzib beradi."
          action={
            <Link href="/app/plan/new">
              <Button>Birinchi planni yaratish</Button>
            </Link>
          }
        />
      ) : (
        <>
          <PlansToolbar brands={brands} params={p} />
          {plans.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Hech narsa topilmadi."
              description="Qidiruv yoki filtrlarga mos plan topilmadi."
              action={
                <Link href="/app/plan">
                  <Button variant="ghost">Filtrlarni tozalash</Button>
                </Link>
              }
            />
          ) : (
            <PlansTable key={buildPlansQuery(p) || "default"} plans={plans} params={p} total={total} />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual verification in browser**

Run `npm run dev`, go to `/app/plan`:
1. If zero plans exist, confirm the `EmptyState` with the calendar icon and "Birinchi planni yaratish" renders correctly.
2. With at least one plan, use the toolbar to search/filter for something that matches nothing → confirm the "Hech narsa topilmadi." `EmptyState` with the search icon renders, and "Filtrlarni tozalash" clears back to the full list.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/plan/page.tsx
git commit -m "refactor: use EmptyState for plan page empty and no-results views"
```

---

### Task 9: Full verification pass

**Files:** None (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all existing tests pass (no test file in this plan needed changes — `plansTable.test.ts` covers pure helpers untouched by the `PlansTable.tsx` refactor).

- [ ] **Step 2: Full typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no new warnings attributable to files touched in this plan.

- [ ] **Step 4: Manual cross-cutting browser check**

Run `npm run dev` and, using `ThemeToggle` to switch between light and dark mode, and a mobile-width viewport (DevTools device toolbar, e.g. 390px):
1. `/app/brands` — empty state (if applicable), delete confirm dialog, toast, all readable and correctly contrast in both themes; dialog and toast don't overflow or get clipped at mobile width.
2. `/app/plan` — same checks, plus the no-results empty state.
3. Confirm Chat (`/app/chat`) was not touched — spot check it still loads normally (this plan made no changes there, so this is a regression guard, not a fix verification).

- [ ] **Step 5: Final commit (if any stray changes)**

```bash
git status
```

If clean, no commit needed — every task already committed its own changes. If anything is uncommitted (e.g. a fix made during manual verification), commit it with a message describing what manual verification caught.

---

## Self-Review Notes

- **Spec coverage:** All five spec goals (Modal/ConfirmDialog, Toast, Skeleton, EmptyState, brand-delete fix, PlansTable migration, hex fix, apostrophe fix, focus-visible pass) map to Tasks 1–8. Skeleton's consumer (route `loading.tsx`) was underspecified in the spec's "Wiring changes" section — Task 4 fills that gap with the two list routes already in scope, not a new page.
- **Type consistency:** `ConfirmDialog`'s prop names (`open`, `title`, `description`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `variant`, `pending`) are identical across Task 2 (definition), Task 6 (`BrandDeleteButton`), and Task 7 (`PlansTable`). `useToast().show(message, tone)` signature is identical across Task 3 (definition), Task 6, and Task 7.
- **Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code.
