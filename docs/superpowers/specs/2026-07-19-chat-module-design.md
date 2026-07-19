# Chat Module Design Spec

**Date:** 2026-07-19  
**Status:** Design approved, ready for implementation

---

## Overview

The Chat Module enables users to have interactive conversations with a marketing advisor that understands their brand context. Users can brainstorm content ideas, develop marketing strategies, and get advice on their business—all within persistent conversation threads.

**Goal:** Users can create conversations scoped to a specific brand, send messages, receive AI-powered marketing advice, and revisit past conversations. 1 credit spent per user message turn.

---

## Architecture

### Data Model

**Existing tables (reused):**
- `chat_conversations` (id, workspace_id, brand_id, user_id, title, created_at)
- `chat_messages` (id, conversation_id, role, content, created_at)

**Key design decisions:**
- Each conversation is **brand-scoped**: belongs to exactly one brand (selected at creation time)
- Message thread includes both user and assistant messages in `chat_messages`
- Title is optional/auto-generated; if not set, defaults to date or "Untitled"
- Conversation title can be user-edited post-creation (optional for MVP)

### Generation Flow

Every user message triggers a generation via `runStructuredGeneration()`:
- **Module:** `"chat"`
- **Brand context:** Cached prefix using `buildBrandContext(brand)` — enables cache reuse across turns in same conversation
- **System instructions:** "You are a helpful marketing advisor for [brand name]. Help the user brainstorm content ideas, develop marketing strategies, and answer questions about their business."
- **User input:** Full conversation history (all previous user + assistant messages) formatted as a thread, followed by the latest user message. This ensures the AI has context of the entire conversation.
- **Output schema:** `{ response: string }` — plain text reply, no structured JSON
- **Max tokens:** 2048
- **Credits spent:** 1 per user turn (not per AI turn)

**Cached system blocks:**
1. `SYSTEM_BASE` (stable persona)
2. Brand context + module instructions (ephemeral cache)

This ensures warm cache for repeated conversations with the same brand.

### Credit Model

- **Cost:** 1 credit per user message
- **Balance check:** Before allowing message send, verify workspace balance ≥ 1
- **Spend:** After successful AI response, debit 1 credit and log to `credit_ledger` with `reason: "generation"`
- **Failure handling:** If AI call fails before saving response, user message is saved but no credit is spent

---

## User Interface

### Pages

#### `/app/chat` — Conversations List

**Purpose:** View all conversations for this workspace.

**Layout:**
- Header: "Suhbatlashuvlar" (Conversations)
- "Yangi suhbat" button (primary CTA) → `/app/chat/new`
- Empty state (if no conversations): "Suhbatlarni yarating va brainstorm qiling"
- Conversation cards (list view):
  - Title (or auto-gen from first message topic)
  - Brand name badge
  - Last message date/time
  - Delete button (trash icon, with confirm dialog)
  - Click card to open `/app/chat/[id]`

**Pagination:** Not needed for MVP; assume < 100 conversations per workspace.

---

#### `/app/chat/new` — Create Conversation

**Purpose:** Start a new conversation.

**Form:**
- Label: "Qaysi brendni bilan suhbatlashmoqchisiz?" (Which brand do you want to chat about?)
- Brand selector (dropdown, required)
- Optional: "Xabar" (initial message) textarea
- Submit button: "Suhbatni boshlash" (Start conversation)

**Behavior:**
- On submit: create `chat_conversations` row with `title = null` (or auto-gen from first message)
- Redirect to `/app/chat/[id]`
- If brand is deleted before submission, show error (RLS will prevent creation anyway)

---

#### `/app/chat/[id]` — Conversation Thread

**Purpose:** Read and participate in a single conversation.

**Layout:**
- Header:
  - Conversation title (editable or static for MVP)
  - Brand name badge
  - Delete button (with confirm)
  - Back link to `/app/chat`
- Message thread (scrollable, newest at bottom):
  - User messages: right-aligned, blue/accent background
  - Assistant messages: left-aligned, gray background
  - Timestamps on hover or subtle
- Input box (bottom, sticky):
  - Textarea: "Xabar yuboring..." placeholder
  - Send button (disabled if balance < 1)
  - Character count (optional; no hard limit)
  - Loading state while AI responds

**Error states:**
- Balance = 0: "Kreditlar yetarli emas. Tarifni yangilang." + send button disabled
- Deleted brand: Thread is read-only, show "Brend o'chirilgan" banner, input disabled
- Generation failure: Toast error "Javob olishda xato. Qayta urinib ko'ring."

**Behavior:**
- User sends message → optimistically show in thread immediately
- POST to `/api/chat/[conversationId]/send`
- On success: append AI response, show updated credits remaining
- On failure: keep user message visible, show error toast, don't debit credit
- Auto-scroll to newest message

---

### Sidebar Navigation

**Update:** Add chat link to `/app/app/layout.tsx` sidebar.

```
/app/chat — "Suhbat"
```

Position: after `/app/brands`, before or with other modules.

---

## API Routes

### `POST /api/chat/[conversationId]/send`

**Purpose:** Send a message in a conversation and get AI response.

**Request body:**
```json
{
  "message": "string (required, non-empty)"
}
```

**Validation:**
- `conversationId` is valid UUID in route
- Conversation exists in DB
- User is workspace member (RLS enforces)
- Message is non-empty string, ≤ 10000 chars (optional limit)
- Brand still exists (optional; can handle deleted brand gracefully)

**Response (200 OK):**
```json
{
  "ok": true,
  "response": "string (AI response text)",
  "creditsLeft": number
}
```

**Response (error):**
```json
{
  "ok": false,
  "error": "string (user-facing error message in Uzbek)"
}
```

**HTTP Status:**
- 200: success
- 400: bad request (invalid input, conversation not found)
- 500: generation failed (AI call error, DB insert error)

**Side effects:**
- Insert row to `chat_messages` for user message (role: "user")
- Call `runStructuredGeneration()` with chat module config
- Insert row to `chat_messages` for AI response (role: "assistant")
- Insert row to `credit_ledger` with delta: -1
- On generation failure: insert user message but don't debit credit

---

## Generation Module (`src/lib/ai/modules/chat.ts`)

**Exports:**

```typescript
export function chatInstructions(): string {
  return `# Vazifa: Marketing Advisor
Siz [BRAND_NAME] uchun ishlaydigan foydali marketing advisor siz.
Foydalanuvchiga kontent idealarini brainstorm qilishda, marketing strategiyalarini ishlab chiqishda va ularning biznesini haqida savollarga javob berishda yordam bering.
O'zbek (lotin) tilida tabiiy va muhim javoblarni yozing.`;
}

export const ChatResponseSchema = z.object({
  response: z.string().min(1).max(10000),
});
```

**Notes:**
- Schema is minimal: just a text response field
- Full conversation history is passed to the AI so it understands the context of previous messages
- Brand name is interpolated into instructions at generation time

---

## Error Handling

| Scenario | Behavior | Message (Uzbek) |
|----------|----------|---|
| Balance < 1 | Disable send button | "Kreditlar yetarli emas. Tarifni yangilang." |
| AI call fails | Keep user message, show error, no credit spent | "Javob olishda xato. Qayta urinib ko'ring." |
| Conversation not found | 404, redirect to `/app/chat` | "Suhbat topilmadi." |
| Deleted brand | Show read-only banner | "Brend o'chirilgan. Suhbatni ko'rishingiz mumkin lekin yangi xabar yubora olmaysiz." |
| Message too long (>10k chars) | 400 validation error | "Xabar juda uzun (max 10000 belgi)." |
| Network error | Retry UI or manual retry button | "Ulanish xatosi. Qayta urinib ko'ring." |

---

## Testing Strategy

### Manual Smoke Tests
1. Create conversation, send message, AI responds, credit balance decreases by 1
2. Send second message in same conversation, verify `cache_read_tokens > 0` (warm cache)
3. Try send message with balance = 0, verify error and no debit
4. Delete conversation, verify it's removed from `/app/chat` list
5. Delete brand, open conversation, verify read-only state and error message
6. Long message input, verify length limit (if enforced)
7. Back button, navigation between `/app/chat` and thread

### Automated Tests (Unit)
- Message ordering by `created_at`
- Conversation queries filtered by workspace
- Chat credit weight in `CREDIT_WEIGHTS`
- Schema validation (ChatResponseSchema)

### End-to-End (Optional for MVP)
- Full signup → brand create → conversation thread → send messages → verify DB state

---

## Scope & Out of Scope

### In Scope
- Persistent conversation list and threads
- Brand-scoped chat with cached context
- Credit spending (1 per turn)
- Read-only state for deleted brands
- Basic error handling and validation

### Out of Scope (Future)
- Conversation title auto-generation (can be "Untitled" or date-based for MVP)
- Conversation search/filter
- Export conversation as PDF/markdown
- Message editing/deletion
- Sharing conversations
- Conversation folders/categories
- Multi-brand conversation (locked to one brand per conversation)
- Web search or tool use by the AI

---

## Success Criteria

- [x] Users can create conversations scoped to a brand
- [x] Users can send messages and receive AI responses in persistent threads
- [x] Chat uses brand context (cached prefix) for cost-effective repeated turns
- [x] 1 credit spent per user turn
- [x] Conversation list shows all threads with brand/date info
- [x] Deleted brands show read-only state in conversations
- [x] Error states are clear and actionable (insufficient credits, network errors, etc.)
