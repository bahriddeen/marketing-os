import { describe, it, expect } from "vitest";
import { buildBrandContext } from "./prompts";
import { CREDIT_WEIGHTS } from "./credits";
import { CopyVariantsSchema } from "./schemas";
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
