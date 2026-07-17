import { describe, it, expect } from "vitest";
import {
  PLAN_CREDITS,
  PLAN_PRICES_USD,
  PRICE_PER_CREDIT_UZS,
  calculateTopupPriceUzs,
} from "./billing";

describe("billing constants", () => {
  it("has credits for every plan", () => {
    expect(PLAN_CREDITS.starter).toBe(300);
    expect(PLAN_CREDITS.professional).toBe(1000);
    expect(PLAN_CREDITS.agency).toBe(3000);
  });

  it("has a matching price entry for every credited plan", () => {
    expect(Object.keys(PLAN_PRICES_USD).sort()).toEqual(Object.keys(PLAN_CREDITS).sort());
  });
});

describe("calculateTopupPriceUzs", () => {
  it("multiplies credits by the flat per-credit rate", () => {
    expect(calculateTopupPriceUzs(10)).toBe(10 * PRICE_PER_CREDIT_UZS);
  });

  it("rounds fractional credit input to the nearest whole credit", () => {
    expect(calculateTopupPriceUzs(10.7)).toBe(11 * PRICE_PER_CREDIT_UZS);
  });

  it("floors negative input at zero", () => {
    expect(calculateTopupPriceUzs(-5)).toBe(0);
  });
});
