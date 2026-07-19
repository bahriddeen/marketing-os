# Chat Streaming & Markdown Design Spec

**Date:** 2026-07-19
**Status:** Design approved, ready for implementation
**Builds on:** `docs/superpowers/specs/2026-07-19-chat-module-design.md` (original chat module), and the bug-fix pass documented in the chat audit earlier the same day.

---

## Overview

The chat feature currently sends one message, waits silently for the full AI response (a static "Javob yozilmoqda..." pulse with no progress signal), then renders the reply as plain unstyled text. This spec adds:

1. **Streaming** — the assistant's reply appears token-by-token as it's generated, eliminating the silent wait, which was confirmed as the actual source of the "slow" feeling (not generation speed itself).
2. **Markdown rendering** — assistant replies render through Markdown (bold, lists, headings, links) instead of a bare `<p>`, and the model is explicitly told it may use Markdown (it currently isn't).

**Scope:** chat only. `runStructuredGeneration()` and every other generation module (copy, content-plan, reels, brand_fill) are untouched — they return structured JSON, not conversational text, and streaming/markdown for them is a separate, bigger project if it's ever wanted.

**Credit policy:** unchanged in spirit — a credit is spent only when a reply fully completes. If a stream fails or drops partway through, nothing is charged and nothing partial is persisted, matching today's "AI call fails → no credit spent" rule.

---

## Architecture

### Protocol: Server-Sent Events over the existing endpoint

`POST /api/chat/[conversationId]/send` keeps its URL and request body (`{ message: string }`), but the response becomes an SSE stream (`Content-Type: text/event-stream`) instead of a single JSON object. Three frame types, one JSON object per `data:` line:

```
data: {"type":"delta","text":"Salom"}

data: {"type":"delta","text":"! Sizga"}

data: {"type":"done","creditsLeft":29}

```

or, on failure at any point:

```
data: {"type":"error","error":"Generatsiya xatosi. Qayta urinib ko‘ring."}

```

Only one of `done` or `error` is ever sent, always as the final frame. A client that sees the connection close without either should treat it the same as `error` (defensive — covers a raw network drop that never gets a chance to write a frame).

### Server: `runStreamingChatGeneration` (new, in `src/lib/ai/engine.ts`)

Added as a sibling to `runStructuredGeneration`, reusing the same module-level `client` and `SYSTEM_BASE` import so the "two cached system blocks" invariant stays centralized in one file rather than duplicated into the route handler:

```typescript
export async function* runStreamingChatGeneration(opts: {
  brandContext: string;
  moduleInstructions: string;
  userInput: string;
}): AsyncGenerator<string, { fullText: string; usage: Anthropic.Usage }, void>
```

- Calls `client.messages.stream({ model, system: [...same two cached blocks...], messages: [{role:"user", content: opts.userInput}], thinking: {type:"adaptive"} })`.
- Iterates the SDK's stream events; yields the delta string for every `content_block_delta` event whose `delta.type === "text_delta"`. `thinking_delta` events are consumed but never yielded — thinking content is model-internal reasoning, not part of the reply, and was never shown to users before this change either.
- Returns (generator return value, not yield) the full accumulated text and the final `usage` block once the underlying stream completes.
- Does **not** touch the database, credit ledger, or `generations` table — same separation of concerns as `runStructuredGeneration`, which also doesn't know about HTTP. All persistence stays in the route handler.

### Server: `send/route.ts` changes

Preamble (validate input, load conversation/brand, check balance, fetch history, insert the user's message) is **unchanged** from the fix already shipped earlier today — the user's message is still persisted before any generation happens.

New response construction:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    const send = (obj: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

    try {
      const gen = runStreamingChatGeneration({ brandContext, moduleInstructions, userInput });
      let fullText = "";
      for await (const delta of gen) {
        fullText += delta;
        send({ type: "delta", text: delta });
      }
      const { usage } = /* generator return value */;

      const parsed = ChatResponseSchema.safeParse({ response: fullText });
      if (!parsed.success) throw new Error("invalid_output");

      // insert assistant message, insert generations row, debit credit_ledger
      // (same three inserts runStructuredGeneration does today, now inlined
      // here since this path doesn't go through it)

      send({ type: "done", creditsLeft: balance - 1 });
    } catch (e) {
      console.error("chat stream failed", e);
      send({ type: "error", error: "Generatsiya xatosi. Qayta urinib ko‘ring." });
    } finally {
      controller.close();
    }
  },
});

return new Response(stream, {
  headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
});
```

Balance is still checked once up front (fail fast, no stream opened at all if `balance < 1`, same 402 JSON response as today — that path stays synchronous, not streamed, since nothing has started yet).

### Client: `ChatInput.tsx`

`handleSend` replaces `fetch().then(r => r.json())` with a streaming read loop:

```typescript
const res = await fetch(url, { method: "POST", ... });
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
onStreamStart(message); // parent shows the user's message + an empty in-progress assistant bubble

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const frames = buffer.split("\n\n");
  buffer = frames.pop() ?? ""; // last element may be incomplete, keep for next read
  for (const frame of frames) {
    const json = frame.replace(/^data: /, "");
    if (!json) continue;
    const evt = JSON.parse(json);
    if (evt.type === "delta") onDelta(evt.text);
    else if (evt.type === "done") onDone(evt.creditsLeft);
    else if (evt.type === "error") onError(evt.error);
  }
}
```

The `onMessageSent(userMessage, response, creditsLeft)` prop is replaced with three callbacks (`onStreamStart`, `onDelta`, `onDone` / `onError`) passed down from `[id]/page.tsx`.

### Client: `[id]/page.tsx`

Replaces the `handleMessageSent` + 3-retry-backoff `retryLoad` logic entirely:

- `onStreamStart(userMessage)`: append the user message and an empty streaming assistant placeholder to `messages` state (both with client-generated temp ids, same as today's optimistic append).
- `onDelta(text)`: append `text` to the placeholder's content, triggering a re-render (this is the token-by-token growth the user will see).
- `onDone(creditsLeft)`: update `creditsLeft`, then do **one** direct fetch of `chat_messages` (no retries needed — `done` means the server has already committed the insert, so a single immediate read is reliable) to replace the temp-id placeholder with the real persisted row. This removes the audit's flagged "optimistic UI can silently diverge" risk, since there's no more silent give-up path.
- `onStreamError(error)`: remove the empty placeholder (or mark it as failed, TBD in implementation — see Open Question below), show the existing error toast, leave the user's message in place (it's already persisted server-side).

### Client: `MessageThread.tsx`

Assistant message content renders through `react-markdown`:

```tsx
{msg.role === "assistant" ? (
  <ReactMarkdown>{msg.content}</ReactMarkdown>
) : (
  <p className="text-sm">{msg.content}</p>
)}
```

User messages stay plain text — there's no reason to markdown-render what the user typed, and it avoids any question of the user's raw input being reinterpreted as formatting. `react-markdown` renders to real DOM elements (no `dangerouslySetInnerHTML`), so this doesn't change the app's XSS posture at all — same as the audit noted for the current plain-text rendering.

Rendering markdown on a string that's still growing mid-stream (partial `**bo` before the closing `**` arrives) is a well-understood, safe pattern — `react-markdown` just re-parses the current string on every render; a temporarily-unclosed marker either renders as literal characters for a frame or is invisible until closed, both of which self-correct on the next chunk. No special handling needed.

### Prompt: `chatInstructions()`

Adds one line (in Uzbek, consistent with the rest of the instructions) telling the model it may use Markdown — bold for key terms, numbered/bulleted lists when suggesting multiple ideas, headings only for genuinely long structured answers. `ChatResponseSchema` is unchanged (still `{ response: z.string().min(1).max(10000) }`); it's now applied with `.safeParse()` against the fully-accumulated stream text instead of via `output_config`/`zodOutputFormat`, since the Anthropic streaming API and structured-output parsing aren't combined here — chat never needed structured output beyond a single text field.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Balance < 1 | Same as today: synchronous 402 JSON, no stream opened. |
| Anthropic stream errors mid-generation | `error` frame sent, nothing persisted, nothing charged. Client shows existing Uzbek error toast. |
| Accumulated text fails `ChatResponseSchema` (e.g. empty) | Treated as a generation failure — `error` frame, nothing persisted or charged. |
| Assistant-message DB insert fails after a successful stream | Same tradeoff as today's already-shipped fix: still send `done` with the full text (the user got and can see their paid-for reply), log the DB error server-side; the row just won't be in the persisted thread until they retry. |
| Client disconnects (closes tab) mid-stream | Server-side generation continues to completion regardless (the `for await` loop isn't tied to the client connection) — reply is still persisted and charged normally, consistent with "charge on full completion, not on client presence." |
| Raw network drop with no `error` frame delivered | Client's read loop throws/`done` never arrives; treat identically to a received `error` frame (fixed timeout not needed — a broken pipe surfaces as a fetch/stream exception). |

---

## Testing Strategy

**Automated:** `chat.test.ts` keeps its existing schema/instructions tests; add one assertion that `chatInstructions()` mentions Markdown. True SSE streaming isn't practical to unit-test without mocking the Anthropic SDK's stream events — consistent with the rest of `send/route.ts` today (already flagged in the audit as untested), this stays manual-smoke-test territory.

**Manual smoke tests:**
1. Send a message, confirm text appears incrementally rather than all at once.
2. Ask a question likely to produce a list ("3 ta kontent g'oyasi bering") and confirm it renders as a real bulleted list, not literal `-` characters.
3. Kill the network mid-stream (devtools offline toggle), confirm no credit is deducted and an error toast appears.
4. Send with balance = 0, confirm the existing synchronous 402 behavior (no streaming attempted).
5. Refresh the page mid-stream (or open in a second tab), confirm the in-progress reply either completes server-side and appears on next load, or is absent — never a half-saved row.

---

## Scope & Out of Scope

**In scope:** streaming for chat's single send endpoint; Markdown rendering for assistant messages; removal of the 3-retry polling hack (superseded by the `done` signal); one Markdown-usage line added to chat's system instructions.

**Out of scope:** streaming/markdown for any other generation module; `remark-gfm` (tables/strikethrough/task-lists) — plain `react-markdown` only; a "stop generation" button; regenerate/edit; partial-token credit billing; retry-with-partial-content on stream failure (a failed stream is simply retried by the user sending again, same as today).

---

## Open Question for Implementation

Whether a stream that errors mid-way should discard the partial text shown to the user, or leave the partial text visible with a "javob uzildi" (interrupted) marker instead of removing it. Both are reasonable; defaulting to **discard and show the error toast** (simpler, matches today's all-or-nothing error UX) unless the implementer sees a strong reason to keep partial text — this is a small enough UI choice not to block spec approval on.

---

## Success Criteria

- [x] Sending a message shows the reply growing token-by-token, not a static loading pulse. (Verified live: EVOS brand, "3 ta kontent g'oyasi bering" — text visibly grew in bursts rather than appearing all at once.)
- [x] Assistant replies render Markdown (bold, lists, headings, links) correctly. (Verified live: numbered list items, bold phrases, and a bulleted list with bold labels all rendered as real HTML elements, not literal `**`/`-` characters.)
- [x] A credit is spent if and only if a reply fully completes. (Verified live: balance went 5→4 after one completed reply, confirmed via reload; a killed-mid-stream request left the balance at 4, unchanged.)
- [x] A dropped/failed stream shows an error and spends no credit. (Verified live: killed the dev server mid-stream — client showed "Ulanish xatosi. Qayta urinib ko'ring.", credit balance unchanged, user's message stayed visible, the broken assistant placeholder was cleanly removed.)
- [x] The 3-retry polling reconciliation code is removed, replaced by the `done`-triggered single fetch. (Verified in code review during implementation — Task 7 review confirmed `retryLoad` fully deleted.)
- [x] No other generation module's code path changes. (Verified in code review — Task 3 review confirmed `runStructuredGeneration`'s signature/behavior unchanged and checked all five external callers.)
