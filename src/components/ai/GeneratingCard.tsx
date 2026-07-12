"use client";
import Card from "@/components/ui/Card";
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
    <Card className="space-y-3">
      <p className="text-sm font-medium text-ink">
        {message}
        <span className="animate-pulse text-accent"> ▍</span>
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full w-1/3 rounded-full bg-accent animate-[indeterminate-slide_1.4s_ease-in-out_infinite]" />
      </div>
    </Card>
  );
}
