import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import CopyForm from "./CopyForm";
import Link from "next/link";

export default async function CopyPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const brands = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Kopiraiting</h1>
      {brands.length === 0 ? (
        <p className="text-muted">
          Avval brend qo‘shing —{" "}
          <Link className="font-medium text-accent hover:underline" href="/app/brands/new">
            yangi brend yaratish
          </Link>
        </p>
      ) : (
        <CopyForm brands={brands} />
      )}
    </div>
  );
}
