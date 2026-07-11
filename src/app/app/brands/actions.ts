"use server";
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

export async function deleteBrand(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("brands").delete().eq("id", String(formData.get("id")));
  revalidatePath("/app/brands");
  redirect("/app/brands");
}
