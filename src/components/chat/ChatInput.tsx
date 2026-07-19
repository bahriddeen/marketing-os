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
      setError("Ulanish xatosi. Qayta urinib ko‘ring.");
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
