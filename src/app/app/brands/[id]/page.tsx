import { createClient } from "@/lib/supabase/server";
import BrandForm from "@/components/BrandForm";
import type { Brand } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Brendni tahrirlash</h1>
      <BrandForm brand={data as Brand} />
    </div>
  );
}
