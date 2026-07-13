import { describe, it, expect } from "vitest";
import { REELS_PERSONA_LABELS, reelsInstructions } from "./reels";

describe("reelsInstructions", () => {
  it("includes topic, product, and goal label", () => {
    const s = reelsInstructions("Yozgi aksiya", "Fitnes abonement", "sales");
    expect(s).toContain("Yozgi aksiya");
    expect(s).toContain("Fitnes abonement");
    expect(s).toContain("sotuvni oshirish");
  });

  it("mentions all 3 personas", () => {
    const s = reelsInstructions("Mavzu", "Mahsulot", "awareness");
    expect(s).toContain("Ekspert");
    expect(s).toContain("Emotsional");
    expect(s).toContain("Sotuv");
  });

  it("is deterministic for identical inputs (cache-safe)", () => {
    expect(reelsInstructions("Mavzu", "Mahsulot", "engagement")).toBe(
      reelsInstructions("Mavzu", "Mahsulot", "engagement")
    );
  });
});

describe("REELS_PERSONA_LABELS", () => {
  it("has Uzbek labels for all 3 personas", () => {
    expect(REELS_PERSONA_LABELS).toEqual({
      expert: "Ekspert",
      emotional: "Emotsional",
      sales: "Sotuv",
    });
  });
});
