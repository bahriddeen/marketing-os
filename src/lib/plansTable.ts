import { PLAN_PLATFORMS, type PlanPlatform } from "@/lib/ai/modules/contentPlan";

export const PLAN_PAGE_SIZES = [10, 25, 50] as const;

export type PlansParams = {
  q: string;
  brand: string;
  platform: PlanPlatform | "";
  page: number;
  size: number;
};

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export function parsePlansParams(
  sp: Record<string, string | string[] | undefined>
): PlansParams {
  const platform = first(sp.platform);
  const size = Number(first(sp.size));
  const rawPage = Math.floor(Number(first(sp.page)));
  return {
    q: first(sp.q).slice(0, 200),
    brand: first(sp.brand),
    platform: (Object.keys(PLAN_PLATFORMS) as PlanPlatform[]).includes(
      platform as PlanPlatform
    )
      ? (platform as PlanPlatform)
      : "",
    page: Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1,
    size: (PLAN_PAGE_SIZES as readonly number[]).includes(size) ? size : 10,
  };
}

export function buildPlansQuery(
  params: PlansParams,
  overrides: Partial<PlansParams> = {}
): string {
  const p = { ...params, ...overrides };
  const parts: string[] = [];
  if (p.q) parts.push(`q=${encodeURIComponent(p.q)}`);
  if (p.brand) parts.push(`brand=${encodeURIComponent(p.brand)}`);
  if (p.platform) parts.push(`platform=${p.platform}`);
  if (p.page > 1) parts.push(`page=${p.page}`);
  if (p.size !== 10) parts.push(`size=${p.size}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function pageItems(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const wanted = [...new Set([1, current - 1, current, current + 1, last])]
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of wanted) {
    if (n - prev === 2) out.push(prev + 1);
    else if (n - prev > 2) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
