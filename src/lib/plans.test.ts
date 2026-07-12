import { describe, it, expect } from "vitest";
import { planFilename, PLAN_STATUS_VALUES, PLAN_STATUS_LABELS } from "./plans";

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
