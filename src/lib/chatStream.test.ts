import { describe, it, expect } from "vitest";
import { formatSSEFrame, parseSSEFrames, type ChatStreamEvent } from "./chatStream";

describe("formatSSEFrame", () => {
  it("serializes a delta event", () => {
    expect(formatSSEFrame({ type: "delta", text: "Salom" })).toBe(
      `data: ${JSON.stringify({ type: "delta", text: "Salom" })}\n\n`
    );
  });

  it("serializes a done event", () => {
    expect(formatSSEFrame({ type: "done", creditsLeft: 29 })).toBe(
      `data: ${JSON.stringify({ type: "done", creditsLeft: 29 })}\n\n`
    );
  });

  it("serializes an error event", () => {
    expect(formatSSEFrame({ type: "error", error: "Xato" })).toBe(
      `data: ${JSON.stringify({ type: "error", error: "Xato" })}\n\n`
    );
  });
});

describe("parseSSEFrames", () => {
  it("parses a single complete frame with no remainder", () => {
    const { events, remainder } = parseSSEFrames(formatSSEFrame({ type: "delta", text: "hi" }));
    expect(events).toEqual([{ type: "delta", text: "hi" }]);
    expect(remainder).toBe("");
  });

  it("parses multiple frames delivered in one chunk, in order", () => {
    const buffer =
      formatSSEFrame({ type: "delta", text: "a" }) + formatSSEFrame({ type: "delta", text: "b" });
    const { events, remainder } = parseSSEFrames(buffer);
    expect(events).toEqual([
      { type: "delta", text: "a" },
      { type: "delta", text: "b" },
    ]);
    expect(remainder).toBe("");
  });

  it("holds back an incomplete trailing frame as remainder", () => {
    const complete = formatSSEFrame({ type: "delta", text: "a" });
    const incomplete = `data: ${JSON.stringify({ type: "delta", text: "b" })}`; // no trailing \n\n yet
    const { events, remainder } = parseSSEFrames(complete + incomplete);
    expect(events).toEqual([{ type: "delta", text: "a" }]);
    expect(remainder).toBe(incomplete);
  });

  it("recovers a frame split across two reads once the remainder is fed back in", () => {
    const full = formatSSEFrame({ type: "done", creditsLeft: 5 });
    const splitPoint = Math.floor(full.length / 2);
    const first = parseSSEFrames(full.slice(0, splitPoint));
    expect(first.events).toEqual([]);
    const second = parseSSEFrames(first.remainder + full.slice(splitPoint));
    expect(second.events).toEqual([{ type: "done", creditsLeft: 5 }]);
    expect(second.remainder).toBe("");
  });

  it("ignores blank input without throwing", () => {
    expect(parseSSEFrames("")).toEqual({ events: [], remainder: "" });
  });

  it("round-trips every event type through format then parse", () => {
    const cases: ChatStreamEvent[] = [
      { type: "delta", text: "matn" },
      { type: "done", creditsLeft: 12 },
      { type: "error", error: "Generatsiya xatosi." },
    ];
    for (const evt of cases) {
      expect(parseSSEFrames(formatSSEFrame(evt)).events).toEqual([evt]);
    }
  });
});
