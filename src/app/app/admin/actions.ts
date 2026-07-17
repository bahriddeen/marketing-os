"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLAN_CREDITS, type SubscriptionPlan } from "@/lib/billing";

const GenerateCodeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscription"), plan: z.enum(["starter", "professional", "agency"]) }),
  z.object({ type: z.literal("topup"), credits: z.number().int().positive() }),
]);

export async function generateCode(
  input: { type: "subscription"; plan: SubscriptionPlan } | { type: "topup"; credits: number }
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const parsed = GenerateCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const rpcParams =
    parsed.data.type === "subscription"
      ? {
          p_type: "subscription",
          p_plan: parsed.data.plan,
          p_credits: PLAN_CREDITS[parsed.data.plan],
        }
      : { p_type: "topup", p_plan: null, p_credits: parsed.data.credits };

  const { data, error } = await supabase.rpc("admin_generate_code", rpcParams);
  if (error || !data) {
    return { ok: false, error: "Kod yaratib bo‘lmadi. Admin huquqini tekshiring." };
  }

  revalidatePath("/app/admin");
  return { ok: true, code: (data as { code: string }).code };
}

const VoidCodeSchema = z.object({ codeId: z.string().uuid() });

export async function voidCode(codeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = VoidCodeSchema.safeParse({ codeId });
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri kod." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_void_code", { p_code_id: parsed.data.codeId });
  if (error || data !== true) {
    return { ok: false, error: "Kodni bekor qilib bo‘lmadi." };
  }

  revalidatePath("/app/admin");
  return { ok: true };
}
