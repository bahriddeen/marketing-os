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
  isLoading?: boolean;
}

export function MessageThread({ messages, isLoading = false }: MessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-xs rounded-lg px-4 py-2 bg-canvas-soft text-muted border border-line animate-pulse">
            <p className="text-sm">Javob yozilmoqda...</p>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
