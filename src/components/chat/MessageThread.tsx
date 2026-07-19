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
