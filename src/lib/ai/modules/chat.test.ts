import { describe, it, expect } from "vitest";
import { chatInstructions, ChatResponseSchema } from "./chat";

describe("chatInstructions", () => {
  it("includes brand name in instructions", () => {
    const brand = "Vetline";
    const instructions = chatInstructions(brand);
    expect(instructions).toContain(brand);
    expect(instructions).toContain("Marketing Advisor");
  });

  it("returns Uzbek instructions", () => {
    const instructions = chatInstructions("TestBrand");
    expect(instructions).toContain("O‘zbek");
    expect(instructions).toContain("Vazifa");
  });

  it("is deterministic", () => {
    const brand = "TestBrand";
    expect(chatInstructions(brand)).toBe(chatInstructions(brand));
  });
});

describe("ChatResponseSchema", () => {
  it("accepts a valid response", () => {
    const result = ChatResponseSchema.safeParse({
      response: "Bu samarali marketing maslahasidur.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty response", () => {
    const result = ChatResponseSchema.safeParse({ response: "" });
    expect(result.success).toBe(false);
  });

  it("rejects response exceeding max length", () => {
    const tooLong = "a".repeat(10001);
    const result = ChatResponseSchema.safeParse({ response: tooLong });
    expect(result.success).toBe(false);
  });

  it("accepts response at max length boundary", () => {
    const maxLength = "a".repeat(10000);
    const result = ChatResponseSchema.safeParse({ response: maxLength });
    expect(result.success).toBe(true);
  });

  it("rejects non-string response", () => {
    const result = ChatResponseSchema.safeParse({ response: 123 });
    expect(result.success).toBe(false);
  });

  it("rejects missing response field", () => {
    const result = ChatResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
