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
