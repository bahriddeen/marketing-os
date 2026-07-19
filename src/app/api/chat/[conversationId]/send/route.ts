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
