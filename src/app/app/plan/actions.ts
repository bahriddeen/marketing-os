"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PLAN_STATUS_VALUES } from "@/lib/plans";

const PostEditSchema = z
  .object({
    topic: z.string().min(1),
    format: z.enum(["post", "carousel", "reels", "story"]),
    hook: z.string(),
    cta: z.string(),
    goal: z.string(),
    status: z.enum(PLAN_STATUS_VALUES),
  })
  .partial();
export type PostEditInput = z.infer<typeof PostEditSchema>;

export async function updatePlanPost(
  postId: string,
  edit: PostEditInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = PostEditSchema.safeParse(edit);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_posts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  revalidatePath("/app/plan");
  return { ok: true };
}

const BulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(PLAN_STATUS_VALUES),
});

export async function bulkUpdateStatus(
  ids: string[],
  status: string
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const parsed = BulkStatusSchema.safeParse({ ids, status });
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri so‘rov." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_posts")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .select("id");
  if (error) {
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  revalidatePath("/app/plan");
  return { ok: true, updated: (data ?? []).length };
}

export async function deletePlan(
  planId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(planId).success) {
    return { ok: false, error: "Plan topilmadi." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_plans")
    .delete()
    .eq("id", planId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: "O‘chirib bo‘lmadi. Qayta urinib ko‘ring." };
  }
  if (!data) {
    return { ok: false, error: "Plan topilmadi." };
  }

  revalidatePath("/app/plan", "layout");
  return { ok: true };
}
