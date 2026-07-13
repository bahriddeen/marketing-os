import { describe, it, expect } from "vitest";
import {
  parsePlansParams,
  buildPlansQuery,
  pageItems,
  PLAN_PAGE_SIZES,
} from "./plansTable";

describe("parsePlansParams", () => {
  it("returns defaults for empty input", () => {
    expect(parsePlansParams({})).toEqual({
      q: "",
      brand: "",
      platform: "",
      page: 1,
      size: 10,
    });
  });

  it("accepts valid values", () => {
    expect(
      parsePlansParams({ q: "avgust", brand: "b1", platform: "both", page: "3", size: "25" })
    ).toEqual({ q: "avgust", brand: "b1", platform: "both", page: 3, size: 25 });
  });

  it("falls back to defaults on hostile values, never throws", () => {
    const p = parsePlansParams({
      platform: "tiktok",
      page: "-4",
      size: "17",
      q: ["a", "b"] as unknown as string,
    });
    expect(p.platform).toBe("");
    expect(p.page).toBe(1);
    expect(p.size).toBe(10);
    expect(p.q).toBe("a");
  });

  it("exports the size whitelist", () => {
    expect(PLAN_PAGE_SIZES).toEqual([10, 25, 50]);
  });
});

describe("buildPlansQuery", () => {
  const defaults = parsePlansParams({});

  it("returns empty string for all-default params", () => {
    expect(buildPlansQuery(defaults)).toBe("");
  });

  it("serializes non-defaults, url-encodes q, applies overrides", () => {
    const p = { ...defaults, q: "yozgi plan", size: 25, page: 2 };
    expect(buildPlansQuery(p)).toBe("?q=yozgi%20plan&page=2&size=25");
    expect(buildPlansQuery(p, { page: 1 })).toBe("?q=yozgi%20plan&size=25");
  });
});

describe("pageItems", () => {
  it("lists all pages when few", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the middle with ellipsis", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, "…", 10]);
    expect(pageItems(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(pageItems(10, 10)).toEqual([1, "…", 9, 10]);
  });

  it("fills a gap of exactly one instead of an ellipsis", () => {
    expect(pageItems(3, 10)).toEqual([1, 2, 3, 4, "…", 10]);
    expect(pageItems(8, 10)).toEqual([1, "…", 7, 8, 9, 10]);
  });
});
