import { PLAN_STATUS_VALUES, type PlanStatus } from "@/lib/plans";
import { PLAN_PLATFORMS, type PlanPlatform } from "@/lib/ai/modules/contentPlan";

export const PAGE_SIZE = 25;

const FORMATS = ["post", "carousel", "reels", "story"] as const;
type PostFormat = (typeof FORMATS)[number];

export type TableParams = {
  q: string;
  brand: string;
  status: PlanStatus | "";
  format: PostFormat | "";
  platform: PlanPlatform | "";
  sort: "date" | "topic";
  dir: "asc" | "desc";
  page: number;
};

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

const oneOf = <T extends string>(v: string, allowed: readonly T[]): T | "" =>
  (allowed as readonly string[]).includes(v) ? (v as T) : "";

export function parseTableParams(
  sp: Record<string, string | string[] | undefined>
): TableParams {
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1);
  return {
    q: first(sp.q).slice(0, 200),
    brand: first(sp.brand),
    status: oneOf(first(sp.status), PLAN_STATUS_VALUES),
    format: oneOf(first(sp.format), FORMATS),
    platform: oneOf(
      first(sp.platform),
      Object.keys(PLAN_PLATFORMS) as PlanPlatform[]
    ),
    sort: oneOf(first(sp.sort), ["date", "topic"] as const) || "date",
    dir: oneOf(first(sp.dir), ["asc", "desc"] as const) || "desc",
    page,
  };
}

export function buildTableQuery(
  params: TableParams,
  overrides: Partial<TableParams> = {}
): string {
  const p = { ...params, ...overrides };
  const parts: string[] = [];
  if (p.q) parts.push(`q=${encodeURIComponent(p.q)}`);
  if (p.brand) parts.push(`brand=${encodeURIComponent(p.brand)}`);
  if (p.status) parts.push(`status=${p.status}`);
  if (p.format) parts.push(`format=${p.format}`);
  if (p.platform) parts.push(`platform=${p.platform}`);
  if (p.sort !== "date") parts.push(`sort=${p.sort}`);
  if (p.dir !== "desc") parts.push(`dir=${p.dir}`);
  if (p.page > 1) parts.push(`page=${p.page}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
