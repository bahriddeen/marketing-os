# Generation Progress Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a rotating, playful Uzbek status message plus an indeterminate progress bar while an AI generation request is in flight, starting with the Copy generator, built as a reusable primitive for future generation modules.

**Architecture:** A `useRotatingStatus` hook cycles through a caller-supplied list of Uzbek status strings on a timer while `active` is true. A `GeneratingCard` component wraps that hook in the existing `Card` primitive, rendering the current message with the same blinking-cursor motif as `CaptionDemo`, plus a CSS-animated indeterminate progress bar. `CopyForm.tsx` renders `GeneratingCard` between the input form and the results list, driven by its existing `loading` state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 (CSS-first, `@theme inline` tokens in `src/app/globals.css`), Vitest 4 for tests, `jsdom` + `@testing-library/react` (new devDependencies, added in Task 1) for hook testing.

## Global Constraints

- All UI copy must be Uzbek Latin script only, using this codebase's U+2018 apostrophe (`‘`), never U+2019. No bare "AI" as a common noun (use "sun'iy intellekt" if the concept must be named). No HTML entities like `&#39;`/`&apos;`.
- Use semantic Tailwind utilities already defined in `@theme inline` (`bg-canvas`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `border-line`, `bg-accent-soft`) — never raw palette classes (`bg-gray-500`) or hardcoded hex.
- Restyle/extend through existing primitives in `src/components/ui/` (`Card`, `Button`) rather than one-off markup.
- Must respect `prefers-reduced-motion` for the JS-driven text rotation (the codebase's global CSS rule in `globals.css:44-50` already collapses all CSS `animation-duration`/`transition-duration` to near-zero under reduced motion, so any CSS `@keyframes` animation added here is automatically neutralized — only the JS `setInterval` cycling needs its own explicit check, matching the pattern already used in `src/components/marketing/CaptionDemo.tsx:16-25`).
- New tests go in `src/**/*.test.ts` (per `vitest.config.ts`'s `include` pattern) — `.test.tsx` files will NOT be picked up without also editing `vitest.config.ts`, so keep test files as `.ts`.

---

### Task 1: Add test infrastructure for React hooks

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `jsdom` and `@testing-library/react` available as devDependencies for Task 2's hook test.

- [ ] **Step 1: Install the new devDependencies**

Run:
```bash
npm install --save-dev jsdom@^29.1.1 @testing-library/react@^16.3.2
```

- [ ] **Step 2: Verify install**

Run: `npm ls jsdom @testing-library/react`
Expected: both packages listed with no "UNMET DEPENDENCY" errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add jsdom and testing-library/react for hook tests"
```

---

### Task 2: `useRotatingStatus` hook

**Files:**
- Create: `src/components/ai/useRotatingStatus.ts`
- Test: `src/components/ai/useRotatingStatus.test.ts`

**Interfaces:**
- Produces: `useRotatingStatus(active: boolean, messages: string[], intervalMs?: number): string` — default export is a named export `useRotatingStatus`. Returns `""` when `active` is `false`; otherwise returns the current message from `messages`, cycling to the next one every `intervalMs` (default `2200`) and looping back to `messages[0]` after the last one. Resets to `messages[0]` the next time `active` becomes `true` after being `false`. Holds on `messages[0]` (no cycling) when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` is `true`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ai/useRotatingStatus.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRotatingStatus } from "./useRotatingStatus";

function mockMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduceMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useRotatingStatus", () => {
  it("returns an empty string when inactive", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() =>
      useRotatingStatus(false, ["A", "B", "C"]),
    );
    expect(result.current).toBe("");
  });

  it("starts on the first message and cycles on the interval", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useRotatingStatus(true, ["A", "B", "C"], 1000),
    );
    expect(result.current).toBe("A");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe("B");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe("C");
  });

  it("loops back to the first message after the last one", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useRotatingStatus(true, ["A", "B"], 1000),
    );
    act(() => {
      vi.advanceTimersByTime(1000); // -> B
      vi.advanceTimersByTime(1000); // -> loop to A
    });
    expect(result.current).toBe("A");
  });

  it("resets to the first message when reactivated", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active }) => useRotatingStatus(active, ["A", "B", "C"], 1000),
      { initialProps: { active: true } },
    );
    act(() => {
      vi.advanceTimersByTime(1000); // -> B
    });
    expect(result.current).toBe("B");

    rerender({ active: false });
    expect(result.current).toBe("");

    rerender({ active: true });
    expect(result.current).toBe("A");
  });

  it("holds on the first message under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useRotatingStatus(true, ["A", "B", "C"], 1000),
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe("A");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/ai/useRotatingStatus.test.ts`
Expected: FAIL — `useRotatingStatus.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/components/ai/useRotatingStatus.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

export function useRotatingStatus(
  active: boolean,
  messages: string[],
  intervalMs = 2200,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  if (!active) return "";
  return messages[index] ?? "";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/ai/useRotatingStatus.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ai/useRotatingStatus.ts src/components/ai/useRotatingStatus.test.ts
git commit -m "feat: add useRotatingStatus hook for AI generation status text"
```

---

### Task 3: Indeterminate progress bar animation

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: a global `@keyframes indeterminate-slide` usable via the Tailwind arbitrary-value utility `animate-[indeterminate-slide_1.4s_ease-in-out_infinite]`.

- [ ] **Step 1: Add the keyframes**

In `src/app/globals.css`, add after the existing `@media (prefers-reduced-motion: reduce)` block (after line 50):

```css

@keyframes indeterminate-slide {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(150%);
  }
  100% {
    transform: translateX(-100%);
  }
}
```

- [ ] **Step 2: Verify the dev server still builds**

Run: `npm run build`
Expected: build succeeds with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add indeterminate-slide keyframes for progress bar"
```

---

### Task 4: `GeneratingCard` component

**Files:**
- Create: `src/components/ai/GeneratingCard.tsx`

**Interfaces:**
- Consumes: `useRotatingStatus(active, messages)` from Task 2 (`src/components/ai/useRotatingStatus.ts`); `Card` default export from `src/components/ui/Card.tsx`; the `indeterminate-slide` keyframes from Task 3.
- Produces: `GeneratingCard` default export, props `{ active: boolean; messages: string[] }`. Renders `null` when `active` is `false`.

- [ ] **Step 1: Write the component**

Create `src/components/ai/GeneratingCard.tsx`:

```tsx
"use client";
import Card from "@/components/ui/Card";
import { useRotatingStatus } from "./useRotatingStatus";

export default function GeneratingCard({
  active,
  messages,
}: {
  active: boolean;
  messages: string[];
}) {
  const message = useRotatingStatus(active, messages);
  if (!active) return null;

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium text-ink">
        {message}
        <span className="animate-pulse text-accent"> ▍</span>
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full w-1/3 rounded-full bg-accent animate-[indeterminate-slide_1.4s_ease-in-out_infinite]" />
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/GeneratingCard.tsx
git commit -m "feat: add GeneratingCard component"
```

---

### Task 5: Wire into `CopyForm.tsx`

**Files:**
- Modify: `src/app/app/copy/CopyForm.tsx`

**Interfaces:**
- Consumes: `GeneratingCard` default export from `src/components/ai/GeneratingCard.tsx` (Task 4).

- [ ] **Step 1: Add the status message list and import**

In `src/app/app/copy/CopyForm.tsx`, add after the existing imports (after line 11):

```tsx
import GeneratingCard from "@/components/ai/GeneratingCard";

const COPY_STATUS_MESSAGES = [
  "O‘ylamoqda…",
  "G‘oyalar qidirmoqda…",
  "So‘zlarni tanlamoqda…",
  "Yozmoqda…",
  "Sayqallamoqda…",
  "Yakunlamoqda…",
];
```

- [ ] **Step 2: Render the card between the form and results**

Replace the closing of the form `Card` and the start of the results map (around line 117-119):

```tsx
      </Card>

      <GeneratingCard active={loading} messages={COPY_STATUS_MESSAGES} />

      {variants.map((v, i) => (
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification in-browser**

Run: `npm run dev`, open `localhost:3000/app/copy` (log in / use an existing session), fill in the form, click "Generatsiya qilish". Confirm:
- The `GeneratingCard` appears below the form immediately, showing "O‘ylamoqda…" with a blinking cursor.
- The message text changes roughly every 2.2s while the request is in flight.
- The progress bar visibly slides back and forth.
- When the response returns, the card disappears and the variant results render in its place.
- With OS-level "reduce motion" enabled, the message stays on "O‘ylamoqda…" the whole time and the progress bar is static (no sliding).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests pass, including the Task 2 hook tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/copy/CopyForm.tsx
git commit -m "feat: show rotating status and progress bar during copy generation"
```

---

## Out of scope (per design doc)

- Real streaming progress from the Anthropic API.
- A cancel/abort action for in-flight generations.
- An elapsed-time counter.
- Wiring `GeneratingCard`/`useRotatingStatus` into any module other than Copy — future modules (content plan, reels, chat) will each define their own status message list and reuse these same primitives when they're built.
