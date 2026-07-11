"use client";
import { useState } from "react";
import {
  COPY_TYPE_LABELS,
  COPY_STYLE_LABELS,
  type CopyType,
  type CopyStyle,
} from "@/lib/ai/modules/copy";

type BrandOption = { id: string; name: string };
type Variant = { text: string };

export default function CopyForm({ brands }: { brands: BrandOption[] }) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [type, setType] = useState<CopyType>("instagram_caption");
  const [style, setStyle] = useState<CopyStyle>("friendly");
  const [topic, setTopic] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setVariants([]);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, type, style, topic }),
      });
      const json = await res.json();
      if (json.ok) {
        setVariants(json.data.variants);
        setCreditsLeft(json.creditsLeft);
      } else {
        setError(json.error ?? "Xatolik yuz berdi.");
      }
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, i: number) {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Brend</span>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full rounded border p-2"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Format</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CopyType)}
              className="w-full rounded border p-2"
            >
              {Object.entries(COPY_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Uslub</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as CopyStyle)}
              className="w-full rounded border p-2"
            >
              {Object.entries(COPY_STYLE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Mavzu / oferta</span>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Masalan: Yangi mijozlar uchun birinchi konsultatsiya bepul"
            className="w-full rounded border p-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !brandId || topic.trim().length < 3}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (1 kredit)"}
        </button>
        {creditsLeft !== null && (
          <p className="text-sm text-gray-500">Qolgan kreditlar: {creditsLeft}</p>
        )}
      </div>

      {variants.map((v, i) => (
        <div key={i} className="space-y-2 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">
              Variant {i + 1}
            </span>
            <button
              onClick={() => copyText(v.text, i)}
              className="text-sm underline"
            >
              {copied === i ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
          <p className="whitespace-pre-wrap">{v.text}</p>
        </div>
      ))}
    </div>
  );
}
