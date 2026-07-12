import { describe, it, expect } from "vitest";
import { parseTableParams, buildTableQuery, PAGE_SIZE } from "./planTable";

describe("parseTableParams", () => {
  it("returns defaults for empty input", () => {
    expect(parseTableParams({})).toEqual({
      q: "",
      brand: "",
      status: "",
      format: "",
      platform: "",
      sort: "date",
      dir: "desc",
      page: 1,
    });
  });

  it("accepts valid values", () => {
    const p = parseTableParams({
      q: "aksiya",
      brand: "b1",
      status: "tayyor",
      format: "reels",
      platform: "both",
      sort: "topic",
      dir: "asc",
      page: "3",
    });
    expect(p).toEqual({
      q: "aksiya",
      brand: "b1",
      status: "tayyor",
      format: "reels",
      platform: "both",
      sort: "topic",
      dir: "asc",
      page: 3,
    });
  });

  it("falls back to defaults on hostile values, never throws", () => {
    const p = parseTableParams({
      status: "hacked",
      format: "video",
      platform: "tiktok",
      sort: "id; drop table",
      dir: "sideways",
      page: "-5",
      q: ["a", "b"] as unknown as string,
    });
    expect(p.status).toBe("");
    expect(p.format).toBe("");
    expect(p.platform).toBe("");
    expect(p.sort).toBe("date");
    expect(p.dir).toBe("desc");
    expect(p.page).toBe(1);
    expect(p.q).toBe("a"); // first value of array
  });

  it("exports PAGE_SIZE 25", () => {
    expect(PAGE_SIZE).toBe(25);
  });
});

describe("buildTableQuery", () => {
  const defaults = parseTableParams({});

  it("returns empty string for all-default params", () => {
    expect(buildTableQuery(defaults)).toBe("");
  });

  it("serializes non-defaults and applies overrides", () => {
    const p = { ...defaults, status: "tayyor" as const, page: 2 };
    expect(buildTableQuery(p)).toBe("?status=tayyor&page=2");
    expect(buildTableQuery(p, { page: 1 })).toBe("?status=tayyor");
    expect(buildTableQuery(p, { dir: "asc" })).toBe("?status=tayyor&dir=asc&page=2");
  });

  it("url-encodes the search query", () => {
    expect(buildTableQuery({ ...defaults, q: "yozgi aksiya" })).toBe(
      "?q=yozgi%20aksiya"
    );
  });
});
