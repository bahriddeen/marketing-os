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
