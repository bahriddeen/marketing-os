"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveBrand(formData: FormData) {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const row = {
    workspace_id: ws.id,
    name: String(formData.get("name")),
    industry: String(formData.get("industry") ?? ""),
    products: lines(formData.get("products")),
    services: lines(formData.get("services")),
    usp: String(formData.get("usp") ?? ""),
    target_audience: lines(formData.get("target_audience")),
    competitors: lines(formData.get("competitors")),
    tone_of_voice: String(formData.get("tone_of_voice") ?? ""),
    brand_values: String(formData.get("brand_values") ?? ""),
    updated_at: new Date().toISOString(),
  };
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("brands").update(row).eq("id", id)
    : await supabase.from("brands").insert(row);
  if (error) throw error;
  revalidatePath("/app/brands");
  redirect("/app/brands");
}

export async function deleteBrand(
  brandId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(brandId).success) {
    return { ok: false, error: "Brend topilmadi." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .delete()
    .eq("id", brandId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: "O‘chirib bo‘lmadi. Qayta urinib ko‘ring." };
  }
  if (!data) {
    return { ok: false, error: "Brend topilmadi." };
  }

  revalidatePath("/app/brands");
  return { ok: true };
}
