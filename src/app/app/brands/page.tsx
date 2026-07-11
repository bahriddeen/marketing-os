import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { deleteBrand } from "./actions";
import type { Brand } from "@/lib/types";
import Link from "next/link";

export default async function BrandsPage() {
  const ws = await getOrCreateWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });
  const brands = (data ?? []) as Brand[];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brendlar</h1>
        <Link
          href="/app/brands/new"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Yangi brend
        </Link>
      </div>
      {brands.length === 0 && (
        <p className="text-gray-500">
          Hali brend yo‘q. Birinchi brendingizni qo‘shing — AI barcha kontentni
          shu ma&apos;lumotlar asosida yaratadi.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((b) => (
          <div key={b.id} className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">{b.name}</h2>
            <p className="text-sm text-gray-500">{b.industry || "—"}</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link className="underline" href={`/app/brands/${b.id}`}>
                Tahrirlash
              </Link>
              <form action={deleteBrand}>
                <input type="hidden" name="id" value={b.id} />
                <button className="text-red-600 underline">O‘chirish</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
