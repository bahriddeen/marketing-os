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
  const [messages, setMessages] = useState<Message[]>([]);
  const [creditsLeft, setCreditsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

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

  const handleMessageSent = (userMessage: string, response: string, newCreditsLeft: number) => {
    const now = new Date().toISOString();
    const userMessageId = `tmp-user-${Date.now()}`;
    const assistantMessageId = `tmp-assistant-${Date.now()}`;

    // Add optimistic messages with actual user message content
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: userMessage, created_at: now },
      {
        id: assistantMessageId,
        role: "assistant",
        content: response,
        created_at: now,
      },
    ]);
    setCreditsLeft(newCreditsLeft);
    setIsLoadingResponse(true);

    // Retry logic to reload messages with exponential backoff
    const retryLoad = async (attempt = 0) => {
      const delays = [300, 600, 1200];
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt - 1]));
      }

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (msgs && msgs.length > 0) {
        // Check if we have the messages we just sent
        const hasUserMsg = msgs.some((m) => m.role === "user" && m.content === userMessage);
        if (hasUserMsg) {
          setMessages(msgs);
          setIsLoadingResponse(false);
          return;
        }
      }

      // Retry if we haven't found the messages yet and haven't exceeded max retries
      if (attempt < 2) {
        retryLoad(attempt + 1);
      } else {
        // Give up after 3 attempts, use optimistic messages
        setIsLoadingResponse(false);
      }
    };

    retryLoad();
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
      alert("O‘chirishda xato: " + error.message);
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
      <MessageThread
        messages={messages}
        isLoading={isLoadingResponse}
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
