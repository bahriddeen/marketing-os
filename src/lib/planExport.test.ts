import { describe, it, expect } from "vitest";
import { PLAN_EXPORT_HEADERS, planRows, planToCsv, planToXlsx, type PlanExportPost } from "./planExport";

const posts: PlanExportPost[] = [
  {
    date: "2026-08-01",
    topic: "Mavzu, \"qo‘shtirnoq\" bilan",
    format: "carousel",
    hook: "Ko‘p qatorli\nhook",
    cta: "Yozing",
    goal: "Faollik",
    status: "elon_qilingan",
  },
];

describe("planRows", () => {
  it("maps posts to rows with Uzbek format and status labels", () => {
    expect(planRows(posts)).toEqual([
      [
        "2026-08-01",
        "Mavzu, \"qo‘shtirnoq\" bilan",
        "Karusel",
        "Ko‘p qatorli\nhook",
        "Yozing",
        "Faollik",
        "E‘lon qilingan",
      ],
    ]);
  });
});

describe("planToCsv", () => {
  it("starts with a UTF-8 BOM and the header row incl. Holat", () => {
    const csv = planToCsv(posts);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(PLAN_EXPORT_HEADERS).toEqual(["Sana", "Mavzu", "Format", "Hook", "CTA", "Maqsad", "Holat"]);
    expect(csv).toContain(PLAN_EXPORT_HEADERS.join(","));
  });

  it("quotes cells containing commas, quotes or newlines (RFC 4180)", () => {
    const csv = planToCsv(posts);
    expect(csv).toContain("\"Mavzu, \"\"qo‘shtirnoq\"\" bilan\"");
    expect(csv).toContain("\"Ko‘p qatorli\nhook\"");
  });
});

describe("planToXlsx", () => {
  it("produces a non-empty zip (xlsx) buffer", async () => {
    const buf = await planToXlsx("Test plan", posts);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
