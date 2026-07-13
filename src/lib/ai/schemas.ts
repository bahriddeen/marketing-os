import { z } from "zod";

export const CopyVariantsSchema = z.object({
  variants: z.array(z.object({ text: z.string() })).min(1).max(3),
});
export type CopyVariants = z.infer<typeof CopyVariantsSchema>;

export const PlanPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topic: z.string(),
  format: z.enum(["post", "carousel", "reels", "story"]),
  hook: z.string(),
  cta: z.string(),
  goal: z.string(),
});
export type PlanPost = z.infer<typeof PlanPostSchema>;

export const ContentPlanSchema = z.object({
  title: z.string(),
  posts: z.array(PlanPostSchema).min(1).max(31),
});
export type ContentPlanOutput = z.infer<typeof ContentPlanSchema>;

export const BrandFillSchema = z.object({
  name: z.string(),
  industry: z.string(),
  products: z.array(z.string()),
  services: z.array(z.string()),
  usp: z.string(),
  target_audience: z.array(z.string()),
  competitors: z.array(z.string()),
  tone_of_voice: z.string(),
  brand_values: z.string(),
});
export type BrandFill = z.infer<typeof BrandFillSchema>;

export const ReelsPersonas = ["expert", "emotional", "sales"] as const;
export type ReelsPersona = (typeof ReelsPersonas)[number];

export const ReelsVariantSchema = z.object({
  persona: z.enum(ReelsPersonas),
  hook: z.string(),
  scenes: z.array(z.string()).min(1),
  voiceover: z.string(),
  caption: z.string(),
  cta: z.string(),
  duration: z.string(),
});
export type ReelsVariant = z.infer<typeof ReelsVariantSchema>;

export const ReelsSchema = z.object({
  variants: z.array(ReelsVariantSchema).length(3),
});
export type ReelsOutput = z.infer<typeof ReelsSchema>;
