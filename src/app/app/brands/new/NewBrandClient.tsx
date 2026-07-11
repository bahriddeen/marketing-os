"use client";
import { useState } from "react";
import BrandForm from "@/components/BrandForm";
import type { BrandFill } from "@/lib/ai/schemas";

export default function NewBrandClient() {
  const [description, setDescription] = useState("");
  const [fill, setFill] = useState<BrandFill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const json = await res.json();
      if (json.ok) setFill(json.data);
      else setError(json.error ?? "Xatolik yuz berdi.");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-xl space-y-3 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">AI bilan to‘ldirish</h2>
        <p className="text-sm text-gray-500">
          Kompaniyangiz haqida erkin yozing — AI formani o‘zi to‘ldiradi.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Masalan: Vetline — Toshkentdagi veterinariya klinikasi. Uy hayvonlari uchun 24/7 xizmat..."
          className="w-full rounded border p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleFill}
          disabled={loading || description.trim().length < 30}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "To‘ldirilmoqda…" : "AI bilan to‘ldirish"}
        </button>
      </div>
      <BrandForm key={fill ? JSON.stringify(fill) : "empty"} initial={fill ?? undefined} />
    </div>
  );
}
