export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; creditsLeft: number }
  | { type: "error"; error: string };

export function formatSSEFrame(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSSEFrames(buffer: string): { events: ChatStreamEvent[]; remainder: string } {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  const events: ChatStreamEvent[] = [];

  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    const json = line.slice("data:".length).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as ChatStreamEvent);
    } catch {
      // malformed frame — skip rather than crash the read loop
    }
  }

  return { events, remainder };
}
