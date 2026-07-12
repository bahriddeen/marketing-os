import type { PlanPost } from "@/lib/ai/schemas";

export type PlanPostEdit = Partial<
  Pick<PlanPost, "topic" | "format" | "hook" | "cta" | "goal">
>;

export function mergePlanPost(
  posts: PlanPost[],
  index: number,
  edit: PlanPostEdit
): PlanPost[] {
  if (!Number.isInteger(index) || index < 0 || index >= posts.length) {
    throw new Error(`post index ${index} out of range`);
  }
  return posts.map((p, i) => (i === index ? { ...p, ...edit } : p));
}

export function planFilename(title: string, ext: "xlsx" | "csv"): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "kontent-plan"}.${ext}`;
}
