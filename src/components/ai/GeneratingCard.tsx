"use client";
import { Loader2 } from "lucide-react";
import { useRotatingStatus } from "./useRotatingStatus";

export default function GeneratingCard({
  active,
  messages,
}: {
  active: boolean;
  messages: string[];
}) {
  const message = useRotatingStatus(active, messages);
  if (!active) return null;

  return (
    <div className="flex items-center gap-2 py-1">
      <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
      <span
        key={message}
        className="text-sm text-muted animate-[fade-in_500ms_ease-out]"
      >
        {message}
      </span>
    </div>
  );
}
