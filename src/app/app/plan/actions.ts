"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PLAN_STATUS_VALUES } from "@/lib/plans";
import { addDays } from "@/lib/calendar";

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

const BulkShiftDatesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  days: z.number().int(),
  planId: z.string().uuid(),
});

export async function bulkShiftDates(
  ids: string[],
  days: number,
  planId: string
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const parsed = BulkShiftDatesSchema.safeParse({ ids, days, planId });
  if (!parsed.success) {
    return { ok: false, error: "Noto‘g‘ri so‘rov." };
  }

  const supabase = await createClient();

  // Fetch all posts to shift
  const { data: posts, error: fetchError } = await supabase
    .from("plan_posts")
    .select("id, date")
    .in("id", parsed.data.ids)
    .eq("plan_id", planId);

  if (fetchError || !posts) {
    return { ok: false, error: "Postlarni yuklashda muammo." };
  }

  // Shift dates individually — upsert() would fail here since it validates
  // NOT NULL columns (plan_id, workspace_id, brand_id, topic, format,
  // position) before evaluating onConflict, even though these are existing
  // rows and only date/updated_at are changing.
  const updates = posts.map((post) => ({
    id: post.id,
    originalDate: post.date,
    newDate: addDays(post.date, parsed.data.days),
  }));

  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("plan_posts")
        .update({ date: u.newDate, updated_at: new Date().toISOString() })
        .eq("id", u.id)
        .select("id")
    )
  );

  const failedIndices = results
    .map((r, i) => (r.error ? i : -1))
    .filter((i) => i >= 0);

  if (failedIndices.length > 0) {
    // Roll back every update that succeeded, so a retry starts from a clean
    // original state instead of double-shifting already-moved posts.
    const succeededUpdates = updates.filter((_, i) => !failedIndices.includes(i));
    await Promise.all(
      succeededUpdates.map((u) =>
        supabase
          .from("plan_posts")
          .update({ date: u.originalDate, updated_at: new Date().toISOString() })
          .eq("id", u.id)
      )
    );
    return { ok: false, error: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." };
  }

  const updatedCount = results.reduce((sum, r) => sum + (r.data?.length ?? 0), 0);

  revalidatePath("/app/plan");
  revalidatePath(`/app/plan/${planId}`, "layout");
  return { ok: true, updated: updatedCount };
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
