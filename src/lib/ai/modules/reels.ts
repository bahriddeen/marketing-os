import { PLAN_GOALS, type PlanGoal } from "@/lib/ai/modules/contentPlan";

export const REELS_PERSONA_LABELS: Record<"expert" | "emotional" | "sales", string> = {
  expert: "Ekspert",
  emotional: "Emotsional",
  sales: "Sotuv",
};

export function reelsInstructions(topic: string, product: string, goal: PlanGoal): string {
  return `# Vazifa: Reels ssenariysi
Mavzu: ${topic}
Mahsulot/xizmat: ${product}
Asosiy maqsad: ${PLAN_GOALS[goal]}

Aynan 3 ta ssenariy yozing — har biri boshqa uslubda:
1. Ekspert — bilim va ishonchga asoslangan uslub
2. Emotsional — his-tuyg‘u va hikoyaga asoslangan uslub
3. Sotuv — to‘g‘ridan-to‘g‘ri taklif va CTA'ga asoslangan uslub

Har bir ssenariy uchun:
- Hook: birinchi 3 soniyada e‘tiborni tortadigan jumla
- Sahnalar: kadr-bakadr ro‘yxat (har birida vaqt oralig‘i va nima ko‘rsatilishi)
- Ovoz matni (voiceover): to‘liq matn
- Caption: post uchun izoh
- CTA: harakatga chaqiruv
- Davomiylik: tavsiya etilgan vaqt (masalan, "15–20 soniya")

Barchasi o‘zbek (lotin) tilida, brend ohangiga mos bo‘lsin.`;
}
