import { describe, it, expect } from "vitest";
import { buildBrandContext } from "./prompts";
import { CREDIT_WEIGHTS } from "./credits";
import { CopyVariantsSchema, ContentPlanSchema, ReelsSchema } from "./schemas";
import type { Brand } from "@/lib/types";

const brand: Brand = {
  id: "b1",
  workspace_id: "w1",
  name: "Vetline",
  industry: "Veterinariya",
  products: ["Hayvon ozuqasi"],
  services: ["Vet konsultatsiya"],
  usp: "24/7 xizmat",
  target_audience: ["Uy hayvoni egalari"],
  competitors: ["ZooMed"],
  tone_of_voice: "Do‘stona",
  brand_values: "G‘amxo‘rlik",
};

describe("buildBrandContext", () => {
  it("includes all brand fields", () => {
    const ctx = buildBrandContext(brand);
    for (const s of [
      "Vetline",
      "Veterinariya",
      "Hayvon ozuqasi",
      "24/7 xizmat",
      "Uy hayvoni egalari",
      "Do‘stona",
    ]) {
      expect(ctx).toContain(s);
    }
  });

  it("is deterministic (cache-safe)", () => {
    expect(buildBrandContext(brand)).toBe(buildBrandContext(brand));
    expect(buildBrandContext(brand)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("credits", () => {
  it("has spec weights", () => {
    expect(CREDIT_WEIGHTS).toEqual({
      content_plan: 10,
      reels: 3,
      copy: 1,
      chat: 1,
      brand_fill: 0,
    });
  });
});

describe("CopyVariantsSchema", () => {
  it("accepts 1-3 variants and rejects empty", () => {
    expect(
      CopyVariantsSchema.safeParse({ variants: [{ text: "a" }, { text: "b" }] })
        .success
    ).toBe(true);
    expect(CopyVariantsSchema.safeParse({ variants: [] }).success).toBe(false);
  });
});

describe("ContentPlanSchema", () => {
  const post = {
    date: "2026-08-03",
    topic: "Uy hayvonlari uchun yozgi parvarish",
    format: "carousel",
    hook: "Yozda itingiz eng ko‘p nimadan aziyat chekadi?",
    cta: "Batafsil konsultatsiya uchun yozing",
    goal: "Auditoriyaga foyda berish",
  };

  it("accepts a valid plan", () => {
    const r = ContentPlanSchema.safeParse({ title: "Vetline — avgust", posts: [post] });
    expect(r.success).toBe(true);
  });

  it("rejects bad format enum and bad date", () => {
    expect(
      ContentPlanSchema.safeParse({ title: "t", posts: [{ ...post, format: "video" }] }).success
    ).toBe(false);
    expect(
      ContentPlanSchema.safeParse({ title: "t", posts: [{ ...post, date: "3-avgust" }] }).success
    ).toBe(false);
  });

  it("rejects empty posts", () => {
    expect(ContentPlanSchema.safeParse({ title: "t", posts: [] }).success).toBe(false);
  });
});

describe("ReelsSchema", () => {
  const variant = (persona: "expert" | "emotional" | "sales") => ({
    persona,
    hook: "Birinchi 3 soniyada diqqatni tortadigan jumla",
    scenes: ["0-3s: mahsulot yaqindan ko‘rsatiladi", "3-10s: foydalanish jarayoni"],
    voiceover: "Ovoz matni shu yerda",
    caption: "Caption matni",
    cta: "Batafsil ma‘lumot uchun yozing",
    duration: "15–20 soniya",
  });

  it("accepts exactly 3 variants with distinct personas", () => {
    const r = ReelsSchema.safeParse({
      variants: [variant("expert"), variant("emotional"), variant("sales")],
    });
    expect(r.success).toBe(true);
  });

  it("rejects fewer than 3 variants", () => {
    expect(
      ReelsSchema.safeParse({ variants: [variant("expert"), variant("emotional")] }).success
    ).toBe(false);
  });

  it("rejects more than 3 variants", () => {
    expect(
      ReelsSchema.safeParse({
        variants: [variant("expert"), variant("emotional"), variant("sales"), variant("expert")],
      }).success
    ).toBe(false);
  });

  it("rejects an invalid persona value", () => {
    const bad = { ...variant("expert"), persona: "funny" };
    expect(
      ReelsSchema.safeParse({ variants: [bad, variant("emotional"), variant("sales")] }).success
    ).toBe(false);
  });

  it("rejects an empty scenes array", () => {
    const bad = { ...variant("expert"), scenes: [] };
    expect(
      ReelsSchema.safeParse({ variants: [bad, variant("emotional"), variant("sales")] }).success
    ).toBe(false);
  });
});
