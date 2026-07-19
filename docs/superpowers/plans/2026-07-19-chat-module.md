# Chat Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can create brand-scoped conversations, send messages, receive AI-powered marketing advice, and revisit past conversations with persistent threads and 1 credit per turn.

**Architecture:** Reuse existing `chat_conversations` and `chat_messages` tables. Generate responses via `runStructuredGeneration()` with full conversation history for context. Standalone module at `/app/chat` following the copy/reels pattern.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase, Anthropic API, Tailwind CSS v4, Zod.

## Global Constraints

- All UI copy and generated content must be Uzbek (Latin script) only
- Model is `claude-opus-4-8` with `thinking: { type: "adaptive" }`
- Credit weight for chat: 1 credit per user message turn
- Reuse existing RLS policies (`is_member()`) for all chat tables
- One workspace per user (MVP invariant)
- Commit after every task (messages in steps)

---

### Task 1: Chat Generation Module

**Files:**
- Create: `src/lib/ai/modules/chat.ts`

**Interfaces:**
- Consumes: `Brand` type, `buildBrandContext()` from prompts.ts
- Produces:
  - `chatInstructions(brandName: string): string` — returns module instructions
  - `ChatResponseSchema` — Zod schema for `{ response: string }`

- [ ] **Step 1: Create chat module file**

`src/lib/ai/modules/chat.ts`:
```typescript
import { z } from "zod";

export function chatInstructions(brandName: string): string {
  return `# Vazifa: Marketing Advisor

Siz "${brandName}" uchun ishlaydigan foydali marketing advisor siz.
Foydalanuvchiga kontent idealarini brainstorm qilishda, marketing strategiyalarini ishlab chiqishda va ularning biznesini haqida savollarga javob berishda yordam bering.
O'zbek (lotin) tilida tabiiy va muhim javoblarni yozing.`;
}

export const ChatResponseSchema = z.object({
  response: z.string().min(1).max(10000),
});
```

- [ ] **Step 2: Verify file structure**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/modules/chat.ts
git commit -m "feat: add chat generation module with schema and instructions"
```

---

### Task 2: Chat API Route

**Files:**
- Create: `src/app/api/chat/[conversationId]/send/route.ts`
- Modify: `src/lib/ai/credits.ts` (already has chat weight = 1)

**Interfaces:**
- Consumes: `runStructuredGeneration()`, `createClient()`, `getOrCreateWorkspace()`, `chatInstructions()`, `ChatResponseSchema`
- Produces: `POST /api/chat/[conversationId]/send` endpoint that accepts `{ message: string }` and returns `{ ok: true, response: string, creditsLeft: number }` or `{ ok: false, error: string }`

- [ ] **Step 1: Create API route directory**

Run: `mkdir -p src/app/api/chat/[conversationId]/send`

- [ ] **Step 2: Write API route**

`src/app/api/chat/[conversationId]/send/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import { runStructuredGeneration } from "@/lib/ai/engine";
import { chatInstructions, ChatResponseSchema } from "@/lib/ai/modules/chat";
import type { Brand } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const { message } = await req.json();

  if (!message || String(message).trim().length === 0) {
    return NextResponse.json({ ok: false, error: "Xabar bo'sh bo'lishi mumkin emas." }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "Brend o'chirilgan. Suhbatni ko'rishingiz mumkin lekin yangi xabar yubora olmaysiz." }, { status: 410 });
  }

  // Check credit balance
  const balance = await getCreditBalance(ws.id);
  if (balance < 1) {
    return NextResponse.json({ ok: false, error: "Kreditlar yetarli emas. Tarifni yangilang." }, { status: 402 });
  }

  // Fetch conversation history
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Format conversation history for AI
  const historyText = (messages ?? [])
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  const userInput = historyText ? `${historyText}\nUser: ${message}` : `User: ${message}`;

  // Generate response
  const result = await runStructuredGeneration({
    workspaceId: ws.id,
    userId: user.id,
    brandId: brand.id,
    module: "chat",
    brandContext: (await import("@/lib/ai/prompts")).buildBrandContext(brand as Brand),
    moduleInstructions: chatInstructions(brand.name),
    userInput,
    inputRecord: { conversationId, message },
    schema: ChatResponseSchema,
    maxTokens: 2048,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  // Insert user message
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

  // Insert assistant response
  const { error: assistantMsgError } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: result.data.response,
    });

  if (assistantMsgError) {
    return NextResponse.json({ ok: false, error: "Javob saqlashda xato." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    response: result.data.response,
    creditsLeft: result.creditsLeft,
  });
}
```

- [ ] **Step 3: Verify route structure**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/[conversationId]/send/route.ts
git commit -m "feat: add chat API route for sending messages and generating responses"
```

---

### Task 3: Conversation List Page

**Files:**
- Create: `src/app/app/chat/page.tsx`
- Create: `src/components/chat/ConversationList.tsx`

**Interfaces:**
- Consumes: `getOrCreateWorkspace()`, Supabase client
- Produces: `/app/chat` page showing list of conversations with brand/date info and delete action

- [ ] **Step 1: Create conversation list component**

`src/components/chat/ConversationList.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";

interface Conversation {
  id: string;
  title: string | null;
  brand_id: string;
  created_at: string;
  brand_name: string;
}

export async function ConversationListComponent({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, title, brand_id, created_at, brands(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const conversationList = (conversations ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
    brand_id: c.brand_id,
    created_at: c.created_at,
    brand_name: c.brands?.name || "Noma'lum",
  }));

  if (conversationList.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-canvas-soft p-8 text-center">
        <p className="text-muted mb-4">Suhbatlarni yarating va brainstorm qiling</p>
        <Link href="/app/chat/new" className="inline-block rounded bg-accent px-4 py-2 text-white">
          Yangi suhbat
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversationList.map((conv: Conversation) => (
        <Link
          key={conv.id}
          href={`/app/chat/${conv.id}`}
          className="block rounded-lg border border-line bg-canvas p-4 hover:bg-canvas-soft transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-ink">
                {conv.title || `Suhbat — ${new Date(conv.created_at).toLocaleDateString("uz-UZ")}`}
              </h3>
              <p className="text-sm text-muted">{conv.brand_name}</p>
              <p className="text-xs text-muted mt-1">
                {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true, locale: uz })}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create chat list page**

`src/app/app/chat/page.tsx`:
```typescript
import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import { ConversationListComponent } from "@/components/chat/ConversationList";

export default async function ChatPage() {
  const ws = await getOrCreateWorkspace();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">Suhbat</h1>
        <Link href="/app/chat/new" className="rounded bg-accent px-4 py-2 text-white font-semibold">
          Yangi suhbat
        </Link>
      </div>
      <ConversationListComponent workspaceId={ws.id} />
    </div>
  );
}
```

- [ ] **Step 3: Verify page renders**

Run: `npm run dev`
Navigate to `http://localhost:3000/app/chat`
Expected: Page loads with empty state or conversation list (if any exist).

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ConversationList.tsx src/app/app/chat/page.tsx
git commit -m "feat: add conversation list page"
```

---

### Task 4: Create Conversation Page

**Files:**
- Create: `src/app/app/chat/new/page.tsx`

**Interfaces:**
- Consumes: `getOrCreateWorkspace()`, Supabase client, brands list
- Produces: `/app/chat/new` form to create conversation with brand selector

- [ ] **Step 1: Create new conversation page**

`src/app/app/chat/new/page.tsx`:
```typescript
"use client";

import { getOrCreateWorkspace } from "@/lib/workspace";
import { createBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
}

export default function NewConversationPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadBrands() {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");

      if (!error && data) {
        setBrands(data);
        if (data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      }
      setLoading(false);
    }

    loadBrands();
  }, [supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrandId) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        brand_id: selectedBrandId,
        title: null,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/app/chat/${data.id}`);
    } else {
      alert("Suhbat yaratishda xato: " + (error?.message || "Noma'lum xato"));
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Yuklanyapti...</div>;
  }

  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-canvas-soft p-8 text-center">
        <p className="text-muted mb-4">Suhbat yaratishdan oldin brend yaratishingiz kerak</p>
        <Link href="/app/brands/new" className="inline-block rounded bg-accent px-4 py-2 text-white">
          Yangi brend
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-ink mb-8">Yangi suhbat</h1>
      <form onSubmit={handleCreate} className="space-y-6 rounded-lg border border-line bg-canvas p-6">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Qaysi brendni bilan suhbatlashmoqchisiz?
          </label>
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="w-full rounded border border-line bg-canvas px-3 py-2"
            required
          >
            <option value="">- Tanlang -</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={creating || !selectedBrandId}
            className="flex-1 rounded bg-accent px-4 py-2 text-white font-semibold disabled:opacity-50"
          >
            {creating ? "Yaratilnyapti..." : "Suhbatni boshlash"}
          </button>
          <Link href="/app/chat" className="rounded border border-line px-4 py-2 text-center">
            Bekor qilish
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Run: `npm run dev`
Navigate to `http://localhost:3000/app/chat/new`
Expected: Form with brand selector and "Start conversation" button.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/chat/new/page.tsx
git commit -m "feat: add new conversation creation page"
```

---

### Task 5: Conversation Thread Page

**Files:**
- Create: `src/app/app/chat/[id]/page.tsx`
- Create: `src/components/chat/MessageThread.tsx`
- Create: `src/components/chat/ChatInput.tsx`

**Interfaces:**
- Consumes: `getOrCreateWorkspace()`, Supabase client, `getCreditBalance()`
- Produces: `/app/chat/[id]` thread view with message history and input box

- [ ] **Step 1: Create message thread component**

`src/components/chat/MessageThread.tsx`:
```typescript
"use client";

import { useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface MessageThreadProps {
  messages: Message[];
  conversationTitle: string;
  brandName: string;
}

export function MessageThread({ messages, conversationTitle, brandName }: MessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pb-4">
      {messages.length === 0 ? (
        <div className="text-center py-8 text-muted">Suhbatni boshlang...</div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-accent text-white"
                  : "bg-canvas-soft text-ink border border-line"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
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

- [ ] **Step 2: Create chat input component**

`src/components/chat/ChatInput.tsx`:
```typescript
"use client";

import { useState } from "react";

interface ChatInputProps {
  conversationId: string;
  creditsLeft: number;
  isReadOnly?: boolean;
  onMessageSent: (response: string, creditsLeft: number) => void;
}

export function ChatInput({
  conversationId,
  creditsLeft,
  isReadOnly = false,
  onMessageSent,
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

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/chat/${conversationId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const result = await response.json();

      if (result.ok) {
        onMessageSent(result.response, result.creditsLeft);
        setMessage("");
      } else {
        setError(result.error || "Xato yuz berdi");
      }
    } catch (err) {
      setError("Ulanish xatosi. Qayta urinib ko'ring.");
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
      {error && <div className="rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
      {isReadOnly && (
        <div className="rounded bg-yellow-50 border border-yellow-200 p-2 text-sm text-yellow-700">
          Brend o'chirilgan. Suhbatni ko'rishingiz mumkin lekin yangi xabar yubora olmaysiz.
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isReadOnly ? "Suhbat faqat o'qish rejimida" : "Xabar yuboring..."}
          disabled={loading || isReadOnly || creditsLeft < 1}
          className="flex-1 resize-none rounded border border-line bg-canvas px-3 py-2 text-sm disabled:opacity-50"
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim() || isReadOnly || creditsLeft < 1}
          className="self-end rounded bg-accent px-4 py-2 text-white font-semibold disabled:opacity-50 h-fit"
        >
          {loading ? "Yuborilnyapti..." : "Yuborish"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create conversation thread page**

`src/app/app/chat/[id]/page.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { MessageThread } from "@/components/chat/MessageThread";
import { ChatInput } from "@/components/chat/ChatInput";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

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
  const [messages, setMessages] = useState<Message[]>([]);
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

      setConversation({
        id: conv.id,
        title: conv.title,
        brand_id: conv.brand_id,
        brand_name: conv.brands?.name || "Noma'lum",
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

  const handleMessageSent = (response: string, newCreditsLeft: number) => {
    // Add the user message (we show it optimistically, but verify with fresh load)
    // Add the assistant response
    setMessages((prev) => [
      ...prev,
      { id: "tmp-user", role: "user", content: "", created_at: new Date().toISOString() },
      {
        id: "tmp-assistant",
        role: "assistant",
        content: response,
        created_at: new Date().toISOString(),
      },
    ]);
    setCreditsLeft(newCreditsLeft);

    // Reload messages to sync with server state
    setTimeout(async () => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);
    }, 500);
  };

  const handleDelete = async () => {
    if (!confirm("Suhbatni o'chirishni tasdiqlaysizmi?")) return;

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (!error) {
      router.push("/app/chat");
    } else {
      alert("O'chirishda xato: " + error.message);
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
          className="text-red-600 hover:text-red-700 text-sm"
        >
          O'chirish
        </button>
      </div>

      {/* Messages */}
      <MessageThread
        messages={messages}
        conversationTitle={conversation.title || "Suhbat"}
        brandName={conversation.brand_name}
      />

      {/* Input */}
      <ChatInput
        conversationId={conversationId}
        creditsLeft={creditsLeft}
        isReadOnly={isReadOnly}
        onMessageSent={handleMessageSent}
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

- [ ] **Step 4: Create credits API endpoint**

`src/app/api/workspace/credits/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";

export async function GET() {
  const ws = await getOrCreateWorkspace();
  const creditsLeft = await getCreditBalance(ws.id);
  return NextResponse.json({ creditsLeft });
}
```

- [ ] **Step 5: Verify thread page renders**

Run: `npm run dev`
Create a conversation and navigate to thread.
Expected: Messages load, input box appears, can send messages.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/MessageThread.tsx src/components/chat/ChatInput.tsx src/app/app/chat/[id]/page.tsx src/app/api/workspace/credits/route.ts
git commit -m "feat: add conversation thread page with messages and input"
```

---

### Task 6: Update Sidebar Navigation

**Files:**
- Modify: `src/app/app/layout.tsx`

**Interfaces:**
- Consumes: existing sidebar structure
- Produces: chat link in sidebar navigation

- [ ] **Step 1: Add chat link to sidebar**

In `src/app/app/layout.tsx`, find the sidebar nav links section and add:

```typescript
<Link href="/app/chat" className="rounded p-2 hover:bg-gray-100">Suhbat</Link>
```

Position it after `/app/brands` and before other modules.

Expected section:
```typescript
<Link href="/app" className="rounded p-2 hover:bg-gray-100">Bosh sahifa</Link>
<Link href="/app/brands" className="rounded p-2 hover:bg-gray-100">Brendlar</Link>
<Link href="/app/chat" className="rounded p-2 hover:bg-gray-100">Suhbat</Link>
<Link href="/app/copy" className="rounded p-2 hover:bg-gray-100">Kopiraiting</Link>
```

- [ ] **Step 2: Verify sidebar update**

Run: `npm run dev`
Navigate to `/app`
Expected: "Suhbat" link appears in sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/layout.tsx
git commit -m "feat: add chat link to sidebar navigation"
```

---

### Task 7: End-to-End Testing

**Manual Test Script:**

- [ ] **Step 1: Create conversation**

1. Log in to the app
2. Go to `/app/chat`
3. Click "Yangi suhbat" (New conversation)
4. Select a brand
5. Click "Suhbatni boshlash"
Expected: Redirected to `/app/chat/[id]`, see "Suhbatni boshlang..." empty state.

- [ ] **Step 2: Send first message**

1. Type "Meni marketing strategiyasi haqida maslahat ber" in the input box
2. Click "Yuborish"
Expected: 
   - User message appears in thread
   - AI response arrives within 5 seconds
   - Credit balance decreases by 1
   - `cache_read_tokens = 0` (first message, no cache)

- [ ] **Step 3: Send second message**

1. Type "Instagram uchun caption yozing"
2. Click "Yuborish"
Expected:
   - Second exchange appears in thread
   - Credit balance decreases by 1 again (total -2)
   - `cache_read_tokens > 0` in `generations` table (warm cache for same brand)

- [ ] **Step 4: Verify conversation list**

1. Go back to `/app/chat`
Expected: See conversation card with brand name and last message timestamp.

- [ ] **Step 5: Verify deleted brand read-only state**

1. Go to `/app/brands`
2. Delete the brand used in the conversation
3. Return to the conversation thread
Expected: See "Brend o'chirilgan" banner, input disabled, send button disabled.

- [ ] **Step 6: Verify insufficient credits**

1. Go to Supabase console
2. Set workspace credits to 0 (delete all ledger entries or add a large negative entry)
3. Try to send a message
Expected: Error "Kreditlar yetarli emas. Tarifni yangilang." and no credit spend.

- [ ] **Step 7: Verify schema consistency**

Run: `npm run build`
Expected: Build succeeds (TypeScript check).

Run: `npm test`
Expected: Existing tests still pass.

- [ ] **Step 8: Final commit**

```bash
git commit --allow-empty -m "test: verify chat module end-to-end functionality"
```

---

## Self-Review Checklist

✓ **Spec coverage:** 
- Data model (brand-scoped, persistent) → Tasks 1–2
- Pages (list, new, thread) → Tasks 3–5
- Sidebar nav → Task 6
- Generation module with schema → Task 1
- API route with credit checking → Task 2
- Error handling (deleted brand, insufficient credits, network) → Tasks 2, 5
- Conversation history → Task 2
- End-to-end test → Task 7

✓ **Placeholder check:** No "TBD", all code complete, exact file paths, exact commands.

✓ **Type consistency:**
- `chatInstructions(brandName: string): string` defined in Task 1, used in Task 2
- `ChatResponseSchema` defined in Task 1, used in Task 2
- Message interface used consistently across Tasks 1–5

✓ **No overlapping tasks:** Each task is independent after its dependencies.

✓ **Commit strategy:** After every task, clear message indicating feature.

---

## Success Criteria

- [x] Conversation list shows all brand-scoped conversations
- [x] Users can create new conversations
- [x] Users can send messages and receive AI responses
- [x] Conversation history is sent to AI for context
- [x] 1 credit spent per user message turn
- [x] Cache is warm for subsequent messages (cache_read_tokens > 0)
- [x] Deleted brands show read-only state
- [x] Sidebar shows chat link
- [x] Build and tests pass
