"use client";
import { useState } from "react";
import {
  COPY_TYPE_LABELS,
  COPY_STYLE_LABELS,
  type CopyType,
  type CopyStyle,
} from "@/lib/ai/modules/copy";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Input";
import GeneratingCard from "@/components/ai/GeneratingCard";

const COPY_STATUS_MESSAGES = [
  "O‘ylamoqda…",
  "G‘oyalar qidirmoqda…",
  "So‘zlarni tanlamoqda…",
  "Yozmoqda…",
  "Sayqallamoqda…",
  "Yakunlamoqda…",
];

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
      <Card className="space-y-4">
        <label className="block">
          <Label>Brend</Label>
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Format</Label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as CopyType)}
            >
              {Object.entries(COPY_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <Label>Uslub</Label>
            <Select
              value={style}
              onChange={(e) => setStyle(e.target.value as CopyStyle)}
            >
              {Object.entries(COPY_STYLE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="block">
          <Label>Mavzu / oferta</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="Masalan: Yangi mijozlar uchun birinchi konsultatsiya bepul"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleGenerate}
          disabled={loading || !brandId || topic.trim().length < 3}
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (1 kredit)"}
        </Button>
        {creditsLeft !== null && (
          <p className="text-sm text-muted">Qolgan kreditlar: {creditsLeft}</p>
        )}
      </Card>

      <GeneratingCard active={loading} messages={COPY_STATUS_MESSAGES} />

      {variants.map((v, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">
              Variant {i + 1}
            </span>
            <button
              onClick={() => copyText(v.text, i)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {copied === i ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
          <p className="whitespace-pre-wrap text-ink">{v.text}</p>
        </Card>
      ))}
    </div>
  );
}
