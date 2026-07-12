"use client";
import { useState } from "react";
import BrandForm from "@/components/BrandForm";
import type { BrandFill } from "@/lib/ai/schemas";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import GeneratingCard from "@/components/ai/GeneratingCard";

const BRAND_FILL_STATUS_MESSAGES = [
  "O‘qimoqda…",
  "Ma‘lumotlarni ajratmoqda…",
  "Maydonlarni to‘ldirmoqda…",
  "Aniqlashtirmoqda…",
  "Yakunlamoqda…",
];

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
      <Card className="max-w-xl space-y-3">
        <h2 className="font-semibold text-ink">Sun‘iy intellekt bilan to‘ldirish</h2>
        <p className="text-sm text-muted">
          Kompaniyangiz haqida erkin yozing — Sun‘iy intellekt formani o‘zi to‘ldiradi.
        </p>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Masalan: Vetline — Toshkentdagi veterinariya klinikasi. Uy hayvonlari uchun 24/7 xizmat..."
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleFill}
          disabled={loading || description.trim().length < 30}
        >
          {loading ? "To‘ldirilmoqda…" : "Sun‘iy intellekt bilan to‘ldirish"}
        </Button>
        <GeneratingCard active={loading} messages={BRAND_FILL_STATUS_MESSAGES} />
      </Card>
      <BrandForm
        key={fill ? JSON.stringify(fill) : "empty"}
        initial={fill ?? undefined}
      />
    </div>
  );
}
