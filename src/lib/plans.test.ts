import { describe, it, expect } from "vitest";
import { mergePlanPost, planFilename, PLAN_STATUS_VALUES, PLAN_STATUS_LABELS } from "./plans";
import type { PlanPost } from "@/lib/ai/schemas";

const posts: PlanPost[] = [
  { date: "2026-08-01", topic: "A", format: "post", hook: "h1", cta: "c1", goal: "g1" },
  { date: "2026-08-05", topic: "B", format: "reels", hook: "h2", cta: "c2", goal: "g2" },
];

describe("mergePlanPost", () => {
  it("updates only the target post and keeps the rest", () => {
    const out = mergePlanPost(posts, 1, { topic: "Yangi mavzu", format: "story" });
    expect(out[1]).toEqual({ ...posts[1], topic: "Yangi mavzu", format: "story" });
    expect(out[0]).toEqual(posts[0]);
    expect(posts[1].topic).toBe("B"); // input not mutated
  });

  it("throws on out-of-range index", () => {
    expect(() => mergePlanPost(posts, 2, { topic: "x" })).toThrow();
    expect(() => mergePlanPost(posts, -1, { topic: "x" })).toThrow();
  });
});

describe("planFilename", () => {
  it("slugifies the title and appends the extension", () => {
    expect(planFilename("Vetline — avgust plani", "xlsx")).toBe("vetline-avgust-plani.xlsx");
  });
  it("falls back when nothing survives sanitizing", () => {
    expect(planFilename("’’’", "csv")).toBe("kontent-plan.csv");
  });
});

describe("plan statuses", () => {
  it("has the four spec statuses in order", () => {
    expect(PLAN_STATUS_VALUES).toEqual([
      "qoralama",
      "jarayonda",
      "tayyor",
      "elon_qilingan",
    ]);
  });
  it("labels every status in Uzbek", () => {
    expect(PLAN_STATUS_LABELS.qoralama).toBe("Qoralama");
    expect(PLAN_STATUS_LABELS.jarayonda).toBe("Jarayonda");
    expect(PLAN_STATUS_LABELS.tayyor).toBe("Tayyor");
    expect(PLAN_STATUS_LABELS.elon_qilingan).toBe("E‘lon qilingan");
  });
});
