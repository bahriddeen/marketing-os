export type ModuleId =
  | "content_plan"
  | "reels"
  | "copy"
  | "chat"
  | "brand_fill";

export const CREDIT_WEIGHTS: Record<ModuleId, number> = {
  content_plan: 10,
  reels: 3,
  copy: 1,
  chat: 1,
  brand_fill: 0,
};
