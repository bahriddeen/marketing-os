"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
}

export default function NewConversationPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadBrands() {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");

      if (!error && data) {
        setBrands(data);
        if (data.length > 0) {
          setSelectedBrandId(data[0].id);
        }
      }
      setLoading(false);
    }

    loadBrands();
  }, [supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrandId) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        brand_id: selectedBrandId,
        title: null,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/app/chat/${data.id}`);
    } else {
      alert("Suhbat yaratishda xato: " + (error?.message || "Noma‘lum xato"));
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Yuklanyapti...</div>;
  }

  if (brands.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-canvas-soft p-8 text-center">
        <p className="text-muted mb-4">Suhbat yaratishdan oldin brend yaratishingiz kerak</p>
        <Link href="/app/brands/new" className="inline-block rounded bg-accent px-4 py-2 text-ink">
          Yangi brend
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-ink mb-8">Yangi suhbat</h1>
      <form onSubmit={handleCreate} className="space-y-6 rounded-lg border border-line bg-canvas p-6">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Qaysi brendni bilan suhbatlashmoqchisiz?
          </label>
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="w-full rounded border border-line bg-canvas px-3 py-2"
            required
          >
            <option value="">- Tanlang -</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={creating || !selectedBrandId}
            className="flex-1 rounded bg-accent px-4 py-2 text-ink font-semibold disabled:opacity-50"
          >
            {creating ? "Yaratilnyapti..." : "Suhbatni boshlash"}
          </button>
          <Link href="/app/chat" className="rounded border border-line px-4 py-2 text-center">
            Bekor qilish
          </Link>
        </div>
      </form>
    </div>
  );
}
