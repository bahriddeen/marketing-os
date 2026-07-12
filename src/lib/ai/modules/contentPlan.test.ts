import { describe, it, expect } from "vitest";
import {
  PLAN_PLATFORMS,
  PLAN_GOALS,
  PLAN_FORMAT_LABELS,
  contentPlanInstructions,
} from "./contentPlan";

describe("contentPlanInstructions", () => {
  it("includes platform, goal, count and period", () => {
    const s = contentPlanInstructions("both", "sales", 20, "2026-08-01");
    expect(s).toContain("Instagram va Telegram");
    expect(s).toContain("sotuvni oshirish");
    expect(s).toContain("20 ta");
    expect(s).toContain("2026-08-01");
  });

  it("is deterministic for identical inputs (cache-safe)", () => {
    expect(contentPlanInstructions("instagram", "awareness", 10, "2026-08-01")).toBe(
      contentPlanInstructions("instagram", "awareness", 10, "2026-08-01")
    );
  });
});

describe("plan enums", () => {
  it("has the spec's platforms and goals", () => {
    expect(Object.keys(PLAN_PLATFORMS)).toEqual(["instagram", "telegram", "both"]);
    expect(Object.keys(PLAN_GOALS)).toEqual(["awareness", "engagement", "sales"]);
    expect(Object.keys(PLAN_FORMAT_LABELS)).toEqual(["post", "carousel", "reels", "story"]);
  });
});
