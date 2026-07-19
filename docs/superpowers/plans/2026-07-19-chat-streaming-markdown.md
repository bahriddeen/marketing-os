# Chat Streaming & Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat feature stream its response token-by-token (killing the silent "Javob yozilmoqda..." wait) and render assistant replies as Markdown.

**Architecture:** A new `runStreamingChatGeneration` async generator in `src/lib/ai/engine.ts` wraps `client.messages.stream()` and yields text deltas as they arrive; `POST /api/chat/[conversationId]/send` forwards those deltas to the browser as Server-Sent Events over the same URL, persisting the assistant message and debiting one credit only after the stream fully completes; the client reads the SSE frames incrementally, growing the in-progress message live, then renders it through `react-markdown`.

**Tech Stack:** `@anthropic-ai/sdk` (already installed, using its `MessageStream` — no new AI dependency), `react-markdown` (new dependency, this plan installs it), native `ReadableStream`/SSE (no new streaming library).

## Global Constraints

- Chat only. `runStructuredGeneration()` and every other generation module (copy, content-plan, reels, brand_fill) are untouched by this plan.
- A credit is spent if and only if a reply fully completes. A dropped/failed stream spends nothing and persists nothing beyond the user's own message (which is already saved before generation starts, per the existing fix in `send/route.ts`).
- All UI copy and AI-instruction text is Uzbek (Latin script) — use `‘`/`’` (U+2018/U+2019 style already used in this file, i.e. the codebase's tutuq belgisi convention), never a straight apostrophe, never Russian or English strings.
- No `remark-gfm` or other markdown plugins — plain `react-markdown` only (tables/strikethrough/task-lists are out of scope per the design spec).
- This repo's `vitest.config.ts` only includes `src/**/*.test.ts` (no `.tsx`) and no component-rendering tests exist anywhere in the codebase today — don't add `.test.tsx` files or change that config. Pure, framework-free logic gets real unit tests; React wiring and the SSE network path are verified by typecheck/lint plus the manual smoke test in the final task, consistent with how `send/route.ts` is tested today (not at all, by design — see the audit from earlier this session).
- Next.js 16: route `params` is a `Promise` — `send/route.ts` already does `const { conversationId } = await params;`; keep that.

Full design reference: `docs/superpowers/specs/2026-07-19-chat-streaming-markdown-design.md`.

---

### Task 1: Tell the model it may use Markdown

**Files:**
- Modify: `src/lib/ai/modules/chat.ts`
- Test: `src/lib/ai/modules/chat.test.ts`

**Interfaces:**
- Produces: `chatInstructions(brandName: string): string` — unchanged signature, new content (later tasks don't call this differently).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/ai/modules/chat.test.ts`, inside the existing `describe("chatInstructions", ...)` block:

```typescript
  it("mentions Markdown formatting", () => {
    const instructions = chatInstructions("TestBrand");
    expect(instructions).toContain("Markdown");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/modules/chat.test.ts -t "mentions Markdown formatting"`
Expected: FAIL — instructions string doesn't contain "Markdown".

- [ ] **Step 3: Update the instructions**

In `src/lib/ai/modules/chat.ts`, replace the whole file with:

```typescript
import { z } from "zod";

export function chatInstructions(brandName: string): string {
  return `# Vazifa: Marketing Advisor

Siz "${brandName}" uchun ishlayadigan foydali marketing advisor siz.
Foydalanuvchiga kontent idealarini brainstorm qilishda, marketing strategiyalarini ishlab chiqishda va ularning biznesini haqida savollarga javob berishda yordam bering.
O‘zbek (lotin) tilida tabiiy va muhim javoblarni yozing.
Javoblaringizni tuzilgan va o‘qish oson qilish uchun Markdown formatidan foydalaning: muhim so‘zlarni **qalin** qiling, bir nechta g‘oya taklif qilganda ro‘yxatlardan foydalaning, faqat uzun va tuzilgan javoblarda sarlavhalardan foydalaning.`;
}

export const ChatResponseSchema = z.object({
  response: z.string().min(1).max(10000),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/modules/chat.test.ts`
Expected: all tests in the file PASS (the new one plus the existing 9, for 10 total in this file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/modules/chat.ts src/lib/ai/modules/chat.test.ts
git commit -m "feat: tell the chat model it may use Markdown formatting"
```

---

### Task 2: Pure SSE frame helpers

**Files:**
- Create: `src/lib/chatStream.ts`
- Test: `src/lib/chatStream.test.ts`

**Interfaces:**
- Produces (used by Task 4's route handler and Task 6's client code):
  - `type ChatStreamEvent = { type: "delta"; text: string } | { type: "done"; creditsLeft: number } | { type: "error"; error: string }`
  - `formatSSEFrame(event: ChatStreamEvent): string` — serializes one event to an SSE `data: ...\n\n` line.
  - `parseSSEFrames(buffer: string): { events: ChatStreamEvent[]; remainder: string }` — splits a buffer (which may contain zero, one, or several complete frames plus a trailing incomplete one) into parsed events and the leftover partial text to prepend to the next chunk.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chatStream.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatSSEFrame, parseSSEFrames, type ChatStreamEvent } from "./chatStream";

describe("formatSSEFrame", () => {
  it("serializes a delta event", () => {
    expect(formatSSEFrame({ type: "delta", text: "Salom" })).toBe(
      `data: ${JSON.stringify({ type: "delta", text: "Salom" })}\n\n`
    );
  });

  it("serializes a done event", () => {
    expect(formatSSEFrame({ type: "done", creditsLeft: 29 })).toBe(
      `data: ${JSON.stringify({ type: "done", creditsLeft: 29 })}\n\n`
    );
  });

  it("serializes an error event", () => {
    expect(formatSSEFrame({ type: "error", error: "Xato" })).toBe(
      `data: ${JSON.stringify({ type: "error", error: "Xato" })}\n\n`
    );
  });
});

describe("parseSSEFrames", () => {
  it("parses a single complete frame with no remainder", () => {
    const { events, remainder } = parseSSEFrames(formatSSEFrame({ type: "delta", text: "hi" }));
    expect(events).toEqual([{ type: "delta", text: "hi" }]);
    expect(remainder).toBe("");
  });

  it("parses multiple frames delivered in one chunk, in order", () => {
    const buffer =
      formatSSEFrame({ type: "delta", text: "a" }) + formatSSEFrame({ type: "delta", text: "b" });
    const { events, remainder } = parseSSEFrames(buffer);
    expect(events).toEqual([
      { type: "delta", text: "a" },
      { type: "delta", text: "b" },
    ]);
    expect(remainder).toBe("");
  });

  it("holds back an incomplete trailing frame as remainder", () => {
    const complete = formatSSEFrame({ type: "delta", text: "a" });
    const incomplete = `data: ${JSON.stringify({ type: "delta", text: "b" })}`; // no trailing \n\n yet
    const { events, remainder } = parseSSEFrames(complete + incomplete);
    expect(events).toEqual([{ type: "delta", text: "a" }]);
    expect(remainder).toBe(incomplete);
  });

  it("recovers a frame split across two reads once the remainder is fed back in", () => {
    const full = formatSSEFrame({ type: "done", creditsLeft: 5 });
    const splitPoint = Math.floor(full.length / 2);
    const first = parseSSEFrames(full.slice(0, splitPoint));
    expect(first.events).toEqual([]);
    const second = parseSSEFrames(first.remainder + full.slice(splitPoint));
    expect(second.events).toEqual([{ type: "done", creditsLeft: 5 }]);
    expect(second.remainder).toBe("");
  });

  it("ignores blank input without throwing", () => {
    expect(parseSSEFrames("")).toEqual({ events: [], remainder: "" });
  });

  it("round-trips every event type through format then parse", () => {
    const cases: ChatStreamEvent[] = [
      { type: "delta", text: "matn" },
      { type: "done", creditsLeft: 12 },
      { type: "error", error: "Generatsiya xatosi." },
    ];
    for (const evt of cases) {
      expect(parseSSEFrames(formatSSEFrame(evt)).events).toEqual([evt]);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/chatStream.test.ts`
Expected: FAIL with "Cannot find module './chatStream'" (file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `src/lib/chatStream.ts`:

```typescript
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; creditsLeft: number }
  | { type: "error"; error: string };

export function formatSSEFrame(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSSEFrames(buffer: string): { events: ChatStreamEvent[]; remainder: string } {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  const events: ChatStreamEvent[] = [];

  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    const json = line.slice("data:".length).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as ChatStreamEvent);
    } catch {
      // malformed frame — skip rather than crash the read loop
    }
  }

  return { events, remainder };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/chatStream.test.ts`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chatStream.ts src/lib/chatStream.test.ts
git commit -m "feat: add pure SSE frame encode/decode helpers for chat streaming"
```

---

### Task 3: Streaming generation function in the AI engine

**Files:**
- Modify: `src/lib/ai/engine.ts`

**Interfaces:**
- Consumes: `CREDIT_WEIGHTS`, `type ModuleId` from `./credits`; `SYSTEM_BASE` from `./prompts` (both already imported in this file).
- Produces (used by Task 4):
  - `async function persistGenerationAndDebit(opts: { supabase: Awaited<ReturnType<typeof createClient>>; workspaceId: string; brandId: string | null; userId: string; module: ModuleId; inputRecord: Record<string, unknown>; output: object; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null } }): Promise<{ generationId: string | null }>` — exported (it's also now used internally by `runStructuredGeneration`).
  - `function runStreamingChatGeneration(opts: { brandContext: string; moduleInstructions: string; userInput: string; maxTokens?: number }): AsyncGenerator<string, { fullText: string; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null } }, void>` — yields text deltas, returns the full accumulated text and usage once the underlying Anthropic stream completes.

This task refactors the existing generations-row-insert + credit-debit logic out of `runStructuredGeneration` into a shared `persistGenerationAndDebit` function (so the new streaming path doesn't duplicate it), and adds the new generator. `runStructuredGeneration`'s public signature and behavior are unchanged.

- [ ] **Step 1: Replace the whole file**

`src/lib/ai/engine.ts` has no direct unit tests today (it calls the real Anthropic API), so there's no failing-test step here — this task is verified by Step 2 below (typecheck + full existing suite still passing) rather than a new test. Replace `src/lib/ai/engine.ts` in full with:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CREDIT_WEIGHTS, type ModuleId } from "./credits";
import { SYSTEM_BASE } from "./prompts";

const MODEL = "claude-opus-4-8";
const client = new Anthropic();

export type GenerationResult<T> =
  | { ok: true; data: T; creditsLeft: number; generationId: string | null }
  | { ok: false; error: string };

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
};

export async function persistGenerationAndDebit(opts: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  brandId: string | null;
  userId: string;
  module: ModuleId;
  inputRecord: Record<string, unknown>;
  output: object;
  usage: Usage;
}): Promise<{ generationId: string | null }> {
  const weight = CREDIT_WEIGHTS[opts.module];

  const { data: gen } = await opts.supabase
    .from("generations")
    .insert({
      workspace_id: opts.workspaceId,
      brand_id: opts.brandId,
      user_id: opts.userId,
      module: opts.module,
      input: opts.inputRecord,
      output: opts.output,
      model: MODEL,
      input_tokens: opts.usage.input_tokens,
      output_tokens: opts.usage.output_tokens,
      cache_read_tokens: opts.usage.cache_read_input_tokens ?? 0,
      credits_spent: weight,
    })
    .select("id")
    .single();

  if (weight > 0) {
    await opts.supabase.from("credit_ledger").insert({
      workspace_id: opts.workspaceId,
      delta: -weight,
      reason: "generation",
      generation_id: gen?.id ?? null,
    });
  }

  return { generationId: gen?.id ?? null };
}

export async function runStructuredGeneration<T>(opts: {
  workspaceId: string;
  userId: string;
  brandId: string | null;
  module: ModuleId;
  brandContext: string;
  moduleInstructions: string;
  userInput: string;
  inputRecord: Record<string, unknown>;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<GenerationResult<T>> {
  const supabase = await createClient();
  const weight = CREDIT_WEIGHTS[opts.module];

  const { data: ledger } = await supabase
    .from("credit_ledger")
    .select("delta")
    .eq("workspace_id", opts.workspaceId);
  const balance = (ledger ?? []).reduce((s, r) => s + r.delta, 0);
  if (balance < weight) {
    return { ok: false, error: "Kreditlar yetarli emas. Tarifni yangilang." };
  }

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: opts.brandContext + "\n\n" + opts.moduleInstructions,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.userInput }],
      output_config: { format: zodOutputFormat(opts.schema) },
    });
  } catch (e) {
    console.error("generation failed", e);
    return { ok: false, error: "Generatsiya xatosi. Qayta urinib ko‘ring." };
  }

  const data = response.parsed_output;
  if (!data) {
    return { ok: false, error: "Natijani o‘qib bo‘lmadi. Qayta urinib ko‘ring." };
  }

  const { generationId } = await persistGenerationAndDebit({
    supabase,
    workspaceId: opts.workspaceId,
    brandId: opts.brandId,
    userId: opts.userId,
    module: opts.module,
    inputRecord: opts.inputRecord,
    output: data as object,
    usage: response.usage,
  });

  return { ok: true, data, creditsLeft: balance - weight, generationId };
}

export async function* runStreamingChatGeneration(opts: {
  brandContext: string;
  moduleInstructions: string;
  userInput: string;
  maxTokens?: number;
}): AsyncGenerator<string, { fullText: string; usage: Usage }, void> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: opts.brandContext + "\n\n" + opts.moduleInstructions,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: opts.userInput }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  const finalMessage = await stream.finalMessage();
  let fullText = "";
  for (const block of finalMessage.content) {
    if (block.type === "text") fullText += block.text;
  }

  return { fullText, usage: finalMessage.usage };
}
```

- [ ] **Step 2: Verify no regression**

Run:
```bash
npx tsc --noEmit
npm test
```
Expected: `tsc` reports no errors; all existing test files still pass (65 tests — 55 baseline + 1 from Task 1 + 9 from Task 2 — this task adds no new test files, so the count doesn't change from where Task 2 left it).

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/engine.ts
git commit -m "refactor: extract persistGenerationAndDebit, add runStreamingChatGeneration"
```

---

### Task 4: Stream the send endpoint over SSE

**Files:**
- Modify: `src/app/api/chat/[conversationId]/send/route.ts`

**Interfaces:**
- Consumes: `runStreamingChatGeneration`, `persistGenerationAndDebit` from `@/lib/ai/engine` (Task 3); `formatSSEFrame`, `type ChatStreamEvent` from `@/lib/chatStream` (Task 2); `chatInstructions`, `ChatResponseSchema` from `@/lib/ai/modules/chat` (Task 1, unchanged signatures); `CREDIT_WEIGHTS` from `@/lib/ai/credits`; `buildBrandContext` from `@/lib/ai/prompts`.
- Produces: same route (`POST /api/chat/[conversationId]/send`), same request body shape (`{ message: string }`). Response changes from a single JSON body to an SSE stream (`Content-Type: text/event-stream`) of `ChatStreamEvent` frames on success (HTTP 200); the existing synchronous validation error responses (400/401/402/404/410/500 `NextResponse.json({ok:false,error})`) are unchanged for failures that happen *before* streaming starts.

- [ ] **Step 1: Replace the whole file**

No new automated test here — `send/route.ts` has no test file today (confirmed in the audit; this is accepted, pre-existing project convention, not a gap introduced by this task). Verified by Step 2 (typecheck/lint) and Task 8's manual smoke test. Replace `src/app/api/chat/[conversationId]/send/route.ts` in full with:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import { runStreamingChatGeneration, persistGenerationAndDebit } from "@/lib/ai/engine";
import { chatInstructions, ChatResponseSchema } from "@/lib/ai/modules/chat";
import { CREDIT_WEIGHTS } from "@/lib/ai/credits";
import { buildBrandContext } from "@/lib/ai/prompts";
import { formatSSEFrame, type ChatStreamEvent } from "@/lib/chatStream";
import type { Brand } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  let message: unknown;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Noto‘g‘ri so‘rov." }, { status: 400 });
  }

  if (!message || String(message).trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Xabar bo‘sh bo‘lishi mumkin emas." }, { status: 400 });
  }

  if (String(message).length > 10000) {
    return NextResponse.json({ ok: false, error: "Xabar juda uzun (max 10000 belgi)." }, { status: 400 });
  }

  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Autentifikatsiya xatosi." }, { status: 401 });
  }

  // Verify conversation exists and belongs to this workspace
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .select("id, brand_id")
    .eq("id", conversationId)
    .eq("workspace_id", ws.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ ok: false, error: "Suhbat topilmadi." }, { status: 404 });
  }

  // Load brand and check if deleted
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", conversation.brand_id)
    .single();

  if (!brand) {
    return NextResponse.json({ ok: false, error: "Brend o‘chirilgan. Suhbatni ko‘rishingiz mumkin lekin yangi xabar yubora olmaysiz." }, { status: 410 });
  }

  // Check credit balance
  const balance = await getCreditBalance(ws.id);
  if (balance < CREDIT_WEIGHTS.chat) {
    return NextResponse.json({ ok: false, error: "Kreditlar yetarli emas. Tarifni yangilang." }, { status: 402 });
  }

  // Fetch conversation history (turns prior to this one)
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const historyText = (messages ?? [])
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const userInput = historyText ? `${historyText}\nUser: ${message}` : `User: ${message}`;

  // Persist the user's message before spending any credit, so a failed
  // generation never loses it.
  const { error: userMsgError } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

  if (userMsgError) {
    return NextResponse.json({ ok: false, error: "Xabar saqlashda xato." }, { status: 500 });
  }

  const brandContext = buildBrandContext(brand as Brand);
  const moduleInstructions = chatInstructions(brand.name);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(formatSSEFrame(event)));
      };

      try {
        const gen = runStreamingChatGeneration({ brandContext, moduleInstructions, userInput });

        let next = await gen.next();
        while (!next.done) {
          send({ type: "delta", text: next.value });
          next = await gen.next();
        }
        const { fullText, usage } = next.value;

        const parsed = ChatResponseSchema.safeParse({ response: fullText });
        if (!parsed.success) {
          throw new Error("invalid_output");
        }

        // Insert assistant response. Credit is already about to be spent —
        // surface the reply to the user even if this insert fails, rather
        // than discarding a paid-for response (same tradeoff as the
        // non-streaming path).
        const { error: assistantMsgError } = await supabase
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullText,
          });

        if (assistantMsgError) {
          console.error("failed to persist assistant message", assistantMsgError);
        }

        await persistGenerationAndDebit({
          supabase,
          workspaceId: ws.id,
          brandId: brand.id,
          userId: user.id,
          module: "chat",
          inputRecord: { conversationId, message },
          output: { response: fullText },
          usage,
        });

        send({ type: "done", creditsLeft: balance - CREDIT_WEIGHTS.chat });
      } catch (e) {
        console.error("chat stream failed", e);
        send({ type: "error", error: "Generatsiya xatosi. Qayta urinib ko‘ring." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: both clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/[conversationId]/send/route.ts
git commit -m "feat: stream chat responses over SSE instead of one blocking JSON reply"
```

---

### Task 5: Shared message type and Markdown rendering

**Files:**
- Create: `src/components/chat/types.ts`
- Modify: `src/components/chat/MessageThread.tsx`
- Modify: `package.json` (add `react-markdown`)

**Interfaces:**
- Produces: `export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; created_at: string; streaming?: boolean }` — used by Task 7 (`[id]/page.tsx`) and this task's `MessageThread`.
- `MessageThread` props change from `{ messages: Message[]; isLoading?: boolean }` to `{ messages: ChatMessage[] }` — the per-message `streaming` flag replaces the old thread-level `isLoading` flag (Task 7 sets it on the in-progress assistant message itself).

- [ ] **Step 1: Install the dependency**

Run: `npm install react-markdown`
Expected: `package.json` gains a `react-markdown` entry under `dependencies`; `package-lock.json` updates.

- [ ] **Step 2: Create the shared message type**

Create `src/components/chat/types.ts`:

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  streaming?: boolean;
}
```

- [ ] **Step 3: Update MessageThread**

Replace `src/components/chat/MessageThread.tsx` in full with:

```typescript
"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "./types";

interface MessageThreadProps {
  messages: ChatMessage[];
}

const PROSE_CLASSES =
  "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 " +
  "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold [&_a]:underline [&_a]:text-accent " +
  "[&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs";

export function MessageThread({ messages }: MessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pb-4">
      {messages.length === 0 ? (
        <div className="text-center py-8 text-muted">{"Bu suhbatda hali xabar yo'q. Quyida birinchi xabaringizni yozing."}</div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-accent text-ink"
                  : "bg-canvas-soft text-ink border border-line"
              }`}
            >
              {msg.role === "assistant" ? (
                msg.streaming && msg.content === "" ? (
                  <p className="text-sm text-muted animate-pulse">Javob yozilmoqda...</p>
                ) : (
                  <div className={`text-sm ${PROSE_CLASSES}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.streaming && (
                      <span className="animate-pulse" aria-hidden="true">▍</span>
                    )}
                  </div>
                )
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              <p className="text-xs mt-1 opacity-60">
                {new Date(msg.created_at).toLocaleTimeString("uz-UZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: both clean. (`tsc` will currently still fail on `src/app/app/chat/[id]/page.tsx` and `src/components/chat/ChatInput.tsx` referencing the old `Message` type / `isLoading` prop / `onMessageSent` — that's expected and resolved by Tasks 6–7. If you're running this task in isolation, confirm the *new* files typecheck; the pre-existing callers are fixed next.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/chat/types.ts src/components/chat/MessageThread.tsx
git commit -m "feat: render assistant chat messages as Markdown with per-message streaming state"
```

---

### Task 6: Streaming client in ChatInput

**Files:**
- Modify: `src/components/chat/ChatInput.tsx`

**Interfaces:**
- Consumes: `parseSSEFrames`, `type ChatStreamEvent` from `@/lib/chatStream` (Task 2).
- Produces: new prop shape consumed by Task 7 —
  ```typescript
  interface ChatInputProps {
    conversationId: string;
    creditsLeft: number;
    isReadOnly?: boolean;
    onStreamStart: (userMessage: string) => void;
    onDelta: (text: string) => void;
    onDone: (creditsLeft: number) => void;
    onStreamError: (error: string) => void;
  }
  ```
  (Replaces the old `onMessageSent: (userMessage: string, response: string, creditsLeft: number) => void`.)

- [ ] **Step 1: Replace the whole file**

Replace `src/components/chat/ChatInput.tsx` in full with:

```typescript
"use client";

import { useState } from "react";
import { parseSSEFrames } from "@/lib/chatStream";

interface ChatInputProps {
  conversationId: string;
  creditsLeft: number;
  isReadOnly?: boolean;
  onStreamStart: (userMessage: string) => void;
  onDelta: (text: string) => void;
  onDone: (creditsLeft: number) => void;
  onStreamError: (error: string) => void;
}

export function ChatInput({
  conversationId,
  creditsLeft,
  isReadOnly = false,
  onStreamStart,
  onDelta,
  onDone,
  onStreamError,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    if (creditsLeft < 1) {
      setError("Kreditlar yetarli emas. Tarifni yangilang.");
      return;
    }

    const sentMessage = message;
    setLoading(true);
    setError(null);
    setMessage("");
    onStreamStart(sentMessage);

    try {
      const response = await fetch(`/api/chat/${conversationId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: sentMessage }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const msg = result?.error || "Xato yuz berdi";
        setError(msg);
        onStreamError(msg);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("no_stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSEFrames(buffer);
        buffer = remainder;

        let terminal = false;
        for (const evt of events) {
          if (evt.type === "delta") {
            onDelta(evt.text);
          } else if (evt.type === "done") {
            onDone(evt.creditsLeft);
            terminal = true;
          } else if (evt.type === "error") {
            setError(evt.error);
            onStreamError(evt.error);
            terminal = true;
          }
        }
        if (terminal) break;
      }
    } catch {
      const msg = "Ulanish xatosi. Qayta urinib ko‘ring.";
      setError(msg);
      onStreamError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2 border-t border-line pt-4">
      {error && <div className="rounded bg-danger-soft border border-danger p-2 text-sm text-danger">{error}</div>}
      {isReadOnly && (
        <div className="rounded bg-warn-soft border border-warn p-2 text-sm text-warn">
          Brend o‘chirilgan. Suhbatni ko‘rishingiz mumkin lekin yangi xabar yubora olmaysiz.
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isReadOnly ? "Suhbat faqat o‘qish rejimida" : "Xabar yuboring..."}
          disabled={loading || isReadOnly || creditsLeft < 1}
          className="flex-1 resize-none rounded border border-line bg-canvas px-3 py-2 text-sm disabled:opacity-50"
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim() || isReadOnly || creditsLeft < 1}
          className="self-end rounded bg-accent px-4 py-2 text-ink font-semibold disabled:opacity-50 h-fit"
        >
          {loading ? "Yuborilnyapti..." : "Yuborish"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file (`[id]/page.tsx` will still show errors referencing the old `onMessageSent` prop until Task 7 — that's expected).

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatInput.tsx
git commit -m "feat: read chat responses as an SSE stream in ChatInput"
```

---

### Task 7: Rewire the conversation page to the streaming callbacks

**Files:**
- Modify: `src/app/app/chat/[id]/page.tsx`

**Interfaces:**
- Consumes: `ChatMessage` from `./types` via `@/components/chat/types` (Task 5); the new `ChatInput` props from Task 6.

- [ ] **Step 1: Replace the whole file**

Replace `src/app/app/chat/[id]/page.tsx` in full with:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { MessageThread } from "@/components/chat/MessageThread";
import { ChatInput } from "@/components/chat/ChatInput";
import type { ChatMessage } from "@/components/chat/types";
import Link from "next/link";

type ChatConversationRow = {
  id: string;
  title: string | null;
  brand_id: string;
  brands: { name: string } | { name: string }[] | null;
};

interface Conversation {
  id: string;
  title: string | null;
  brand_id: string;
  brand_name: string;
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const router = useRouter();
  const supabase = createBrowserClient();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [creditsLeft, setCreditsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    const loadConversation = async () => {
      // Load conversation details
      const { data: conv, error: convError } = await supabase
        .from("chat_conversations")
        .select("id, title, brand_id, brands(name)")
        .eq("id", conversationId)
        .single();

      if (convError || !conv) {
        router.push("/app/chat");
        return;
      }

      const c = conv as ChatConversationRow;
      const brandName = Array.isArray(c.brands) ? c.brands[0]?.name : c.brands?.name;
      setConversation({
        id: c.id,
        title: c.title,
        brand_id: c.brand_id,
        brand_name: brandName || "Noma’lum",
      });

      // Check if brand still exists
      const { data: brand } = await supabase
        .from("brands")
        .select("id")
        .eq("id", conv.brand_id)
        .single();

      if (!brand) {
        setIsReadOnly(true);
      }

      // Load messages
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);

      // Load credits
      const response = await fetch("/api/workspace/credits");
      if (response.ok) {
        const { creditsLeft } = await response.json();
        setCreditsLeft(creditsLeft);
      }

      setLoading(false);
    };

    loadConversation();
  }, [conversationId, supabase, router]);

  const refreshMessages = async () => {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (msgs) setMessages(msgs);
  };

  const handleStreamStart = (userMessage: string) => {
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: `tmp-user-${Date.now()}`, role: "user", content: userMessage, created_at: now },
      { id: `tmp-assistant-${Date.now()}`, role: "assistant", content: "", created_at: now, streaming: true },
    ]);
  };

  const handleDelta = (text: string) => {
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.streaming);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], content: updated[idx].content + text };
      return updated;
    });
  };

  const handleDone = (newCreditsLeft: number) => {
    setCreditsLeft(newCreditsLeft);
    // The server has already committed the assistant message by the time
    // `done` arrives, so one direct fetch is enough — no retry/backoff needed.
    refreshMessages();
  };

  const handleStreamError = () => {
    // ChatInput already shows the error banner itself; here we just drop the
    // unfinished assistant placeholder. The user's message is unaffected —
    // it was already persisted server-side before generation started.
    setMessages((prev) => prev.filter((m) => !m.streaming));
  };

  const handleDelete = async () => {
    if (!confirm("Suhbatni o‘chirishni tasdiqlaysizmi?")) return;

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (!error) {
      router.push("/app/chat");
    } else {
      alert("Suhbatni o‘chirishda xato yuz berdi. Qayta urinib ko‘ring.");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Yuklanyapti...</div>;
  }

  if (!conversation) {
    return <div className="text-center py-8">Suhbat topilmadi</div>;
  }

  return (
    <div className="flex flex-col h-screen max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="border-b border-line pb-4 mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {conversation.title || "Suhbat"}
          </h1>
          <p className="text-sm text-muted">{conversation.brand_name}</p>
        </div>
        <button
          onClick={handleDelete}
          className="text-danger hover:opacity-80 text-sm"
        >
          O‘chirish
        </button>
      </div>

      {/* Messages */}
      <MessageThread messages={messages} />

      {/* Input */}
      <ChatInput
        conversationId={conversationId}
        creditsLeft={creditsLeft}
        isReadOnly={isReadOnly}
        onStreamStart={handleStreamStart}
        onDelta={handleDelta}
        onDone={handleDone}
        onStreamError={handleStreamError}
      />

      {/* Back link */}
      <div className="mt-4 text-sm">
        <Link href="/app/chat" className="text-accent hover:underline">
          ← Suhbatlashuvlarga qaytish
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx tsc --noEmit
npm run lint
npm test
```
Expected: all three clean — this is the task where the whole chain (engine → route → ChatInput → page → MessageThread) finally typechecks together end to end. 55 tests still pass (Task 1 added a 56th — see below) plus the 9 new ones from Task 2, so `npm test` should now report 65 passing.

- [ ] **Step 3: Commit**

```bash
git add "src/app/app/chat/[id]/page.tsx"
git commit -m "feat: rewire the conversation page to the streaming chat callbacks"
```

---

### Task 8: Full verification and manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full automated check**

Run:
```bash
npx tsc --noEmit
npm run lint
npm test
```
Expected: all clean; `npm test` reports 65 passed (55 original + 1 from Task 1 + 9 from Task 2).

- [ ] **Step 2: Manual smoke test**

With the dev server running (`npm run dev`), log in and, in an existing or new brand's conversation:

1. Send a message and confirm the reply text appears incrementally (word-by-word or in small bursts), not all at once after a long pause.
2. Ask something likely to produce a list, e.g. "3 ta kontent g'oyasi bering" — confirm it renders as an actual bulleted list (round bullets, indentation), not literal `-`/`*` characters, and that **bold** phrases render bold.
3. With devtools open, toggle Network → Offline partway through a send — confirm an error message appears and the credit counter in the sidebar does *not* decrease.
4. Send a message with the workspace's credit balance at 0 (or temporarily note the balance and compare before/after several sends) — confirm the existing "Kreditlar yetarli emas" flow still triggers correctly before any streaming starts.
5. Refresh the page after a normal completed send — confirm the message persists with its real (non-`tmp-`) id and correct timestamp.

Record the outcome of each step. If any step fails, stop and fix before proceeding — do not mark this task complete with a failing smoke-test step.

- [ ] **Step 3: Update the design spec's success criteria**

In `docs/superpowers/specs/2026-07-19-chat-streaming-markdown-design.md`, check off every box under "Success Criteria" that Step 2 confirmed.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-19-chat-streaming-markdown-design.md
git commit -m "docs: mark chat streaming + markdown success criteria verified"
```
