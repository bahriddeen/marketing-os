import { z } from "zod";

export function chatInstructions(brandName: string): string {
  return `# Vazifa: Marketing Advisor

Siz "${brandName}" uchun ishlayadigan foydali marketing advisor siz.
Foydalanuvchiga kontent idealarini brainstorm qilishda, marketing strategiyalarini ishlab chiqishda va ularning biznesini haqida savollarga javob berishda yordam bering.
O'zbek (lotin) tilida tabiiy va muhim javoblarni yozing.`;
}

export const ChatResponseSchema = z.object({
  response: z.string().min(1).max(10000),
});
