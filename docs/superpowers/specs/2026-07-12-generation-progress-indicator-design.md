# Generation progress indicator — design

## Problem

AI generation buttons (currently just Copy generation in `CopyForm.tsx`) show a static disabled label ("Generatsiya qilinmoqda…") while waiting for the API call, with no sense of progress or that anything is actively happening. The user wants a livelier "the AI is working" cue — rotating status text plus a progress indicator — applied consistently to every AI-related button, including ones added later (content plan, reels, chat).

## Constraints

- `runStructuredGeneration()` (`src/lib/ai/engine.ts`) is a single non-streaming Anthropic call validated against a Zod schema — there is no token stream to derive real completion percentage from. Progress must be simulated/perceived, not literal.
- Must reuse the codebase's existing "generation motif" established by `CaptionDemo.tsx` (accent-colored blinking `▍` cursor, typewriter feel) rather than introducing a generic spinner — this was explicitly flagged as the desired direction in `docs/superpowers/specs/2026-07-12-frontend-redesign-design.md`.
- Must be Uzbek-only copy (Latin script), using this codebase's U+2018 apostrophe convention, no bare "AI" as a common noun, no HTML entities (see `uzbek-copy-gotchas` — literal JSX text only, never through interpolated `{expr}`).
- Must respect `prefers-reduced-motion`, matching `CaptionDemo`'s existing check.
- Must be trivially reusable for future generation modules (content plan, reels, chat) per CLAUDE.md's module-addition pattern — no per-module UI redesign.

## Design

### `useRotatingStatus` hook — `src/components/ai/useRotatingStatus.ts`

```ts
function useRotatingStatus(
  active: boolean,
  messages: string[],
  intervalMs = 2200,
): string
```

- While `active` is true, cycles an index through `messages` on a `setInterval`, looping back to 0 if generation runs longer than the list.
- Resets to index 0 whenever `active` transitions to `false` (so the next generation starts from the first message, not wherever the last run left off).
- If `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, holds on `messages[0]` and never starts the interval.
- Returns the current message string (empty string when `!active`).

### `GeneratingCard` component — `src/components/ai/GeneratingCard.tsx`

```tsx
<GeneratingCard active={loading} messages={COPY_STATUS_MESSAGES} />
```

- Renders `null` when `active` is false.
- When active, renders a `Card` containing:
  - The current rotating status message (from `useRotatingStatus`) followed by a blinking `▍` cursor span (`animate-pulse`, same as `CaptionDemo`).
  - A thin indeterminate progress bar below the text: a fixed-height track (`bg-accent-soft`) with a shorter accent-colored bar that slides back and forth via a new CSS `@keyframes` added to `globals.css` (e.g. `@keyframes indeterminate-slide`), exposed as a Tailwind arbitrary-animation utility. No numeric percentage is shown or implied.
  - The slide animation is skipped (bar rendered static/half-filled) under `prefers-reduced-motion`.
- This card sits between the input form and the results list, and is what the results visually replace once generation completes — reinforcing the "this is where your content is being written" feeling.

### Status messages (per module, defined alongside each module's UI)

For copy generation, `COPY_STATUS_MESSAGES` in `CopyForm.tsx`:

```
O‘ylamoqda…
G‘oyalar qidirmoqda…
So‘zlarni tanlamoqda…
Yozmoqda…
Sayqallamoqda…
Yakunlamoqda…
```

Future modules (content plan, reels, chat) define their own list in the same style when they're built, and pass it to the same `GeneratingCard`.

### Integration into `CopyForm.tsx`

- No change to the button itself — it keeps its existing disabled + "Generatsiya qilinmoqda…" label behavior while `loading` is true.
- Add `<GeneratingCard active={loading} messages={COPY_STATUS_MESSAGES} />` immediately after the form `Card`, before the `variants.map(...)` results list.

### Testing

- Unit test for `useRotatingStatus`: cycles through messages on the interval, loops back at the end, resets on `active` becoming false, and holds on the first message under `prefers-reduced-motion`.
- `GeneratingCard` visual behavior (cursor blink, progress bar animation, mount/unmount) verified manually in-browser per project convention — not meaningfully unit-testable.

## Out of scope

- Real streaming progress from the Anthropic API (would require reworking `engine.ts`, credit debiting, and Zod validation timing — explicitly deferred per user's choice).
- A cancel/abort action for in-flight generations.
- An elapsed-time counter.
