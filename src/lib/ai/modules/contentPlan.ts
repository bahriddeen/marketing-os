import type { PlanPost } from "@/lib/ai/schemas";

export const PLAN_PLATFORMS = {
  instagram: "Instagram",
  telegram: "Telegram",
  both: "Instagram va Telegram",
} as const;
export type PlanPlatform = keyof typeof PLAN_PLATFORMS;

export const PLAN_GOALS = {
  awareness: "brend tanilishini oshirish",
  engagement: "auditoriya faolligini oshirish",
  sales: "sotuvni oshirish",
} as const;
export type PlanGoal = keyof typeof PLAN_GOALS;

export const PLAN_GOAL_LABELS: Record<PlanGoal, string> = {
  awareness: "Tanilish",
  engagement: "Faollik",
  sales: "Sotuv",
};

export const PLAN_FORMAT_LABELS: Record<PlanPost["format"], string> = {
  post: "Post",
  carousel: "Karusel",
  reels: "Reels",
  story: "Story",
};

export function contentPlanInstructions(
  platform: PlanPlatform,
  goal: PlanGoal,
  postCount: number,
  periodStart: string
): string {
  return `# Vazifa: Kontent-plan
Platforma: ${PLAN_PLATFORMS[platform]}
Asosiy maqsad: ${PLAN_GOALS[goal]}
Postlar soni: ${postCount} ta
Davr: ${periodStart} sanasidan boshlanadigan bir oy

${postCount} ta postdan iborat kontent-plan tuzing:
- Har bir post uchun: sana (YYYY-MM-DD, faqat shu oy ichida), mavzu, format (post/carousel/reels/story), hook (dastlabki e‘tiborni tortadigan jumla), CTA va postning maqsadi.
- Sanalarni oy bo‘ylab teng taqsimlang, barqaror haftalik ritm saqlansin.
- Formatlarni aralashtiring: oddiy post, karusel, reels va story.
- Mavzular xilma-xil bo‘lsin: foydali maslahat, mahsulot yoki xizmat taqdimoti, ijtimoiy isbot, aksiya, brend hikoyasi.
- "title" maydoniga planga qisqa nom yozing (brend nomi + oy).`;
}
