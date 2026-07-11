import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { deleteBrand } from "./actions";
import type { Brand } from "@/lib/types";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
        <h1 className="font-display text-2xl font-semibold text-ink">
          Brendlar
        </h1>
        <Link href="/app/brands/new">
          <Button>Yangi brend</Button>
        </Link>
      </div>
      {brands.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">
            Hali brendingiz yo‘q. Birinchi brendni qo‘shing — Sun‘iy intellekt shu
            ma&apos;lumotlar asosida barcha kontentni tayyorlaydi.
          </p>
          <Link href="/app/brands/new" className="mt-4 inline-block">
            <Button>Birinchi brendni qo‘shish</Button>
          </Link>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((b) => (
          <Card key={b.id}>
            <h2 className="font-semibold text-ink">{b.name}</h2>
            <p className="text-sm text-muted">{b.industry || "—"}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link
                className="font-medium text-accent hover:underline"
                href={`/app/brands/${b.id}`}
              >
                Tahrirlash
              </Link>
              <form action={deleteBrand}>
                <input type="hidden" name="id" value={b.id} />
                <button className="font-medium text-danger hover:underline">
                  O‘chirish
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
