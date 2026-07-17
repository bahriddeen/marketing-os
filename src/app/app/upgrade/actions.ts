"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";

const RedeemSchema = z.object({ code: z.string().trim().min(1) });

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "Kod noto‘g‘ri.",
  already_redeemed: "Bu kod allaqachon ishlatilgan.",
  void: "Bu kod bekor qilingan.",
  unauthorized: "Ruxsat yo‘q.",
};

export async function redeemCode(
  code: string
): Promise<
  | { ok: true; type: "subscription" | "topup"; plan: string | null; credits: number }
  | { ok: false; error: string }
> {
  const parsed = RedeemSchema.safeParse({ code });
  if (!parsed.success) {
    return { ok: false, error: "Kodni kiriting." };
  }

  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_code", {
    p_code: parsed.data.code.trim().toUpperCase(),
    p_workspace_id: ws.id,
  });

  if (error) {
    return { ok: false, error: "Xatolik yuz berdi. Qayta urinib ko‘ring." };
  }

  const result = data as {
    ok: boolean;
    error?: string;
    type?: string;
    plan?: string | null;
    credits?: number;
  };
  if (!result.ok) {
    return {
      ok: false,
      error: REDEEM_ERRORS[result.error ?? ""] ?? "Kodni tasdiqlab bo‘lmadi.",
    };
  }

  revalidatePath("/app/upgrade");
  return {
    ok: true,
    type: result.type as "subscription" | "topup",
    plan: result.plan ?? null,
    credits: result.credits ?? 0,
  };
}
