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
