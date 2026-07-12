"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PlanPostSchema, type PlanPost } from "@/lib/ai/schemas";
import { mergePlanPost, type PlanPostEdit } from "@/lib/plans";

const EditSchema = PlanPostSchema.pick({
  topic: true,
  format: true,
  hook: true,
  cta: true,
  goal: true,
}).partial();

export async function updatePlanPost(
  planId: string,
  index: number,
  edit: PlanPostEdit
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = EditSchema.safeParse(edit);
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri qiymat." };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("content_plans")
    .select("posts")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) {
    return { ok: false, error: "Plan topilmadi." };
  }

  let posts: PlanPost[];
  try {
    posts = mergePlanPost(plan.posts as PlanPost[], index, parsed.data);
  } catch {
    return { ok: false, error: "Post topilmadi." };
  }

  const { error } = await supabase
    .from("content_plans")
    .update({ posts, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) {
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  revalidatePath(`/app/plan/${planId}`);
  return { ok: true };
}
