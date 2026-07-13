"use client";
import { useState } from "react";
import { PLAN_GOAL_LABELS, type PlanGoal } from "@/lib/ai/modules/contentPlan";
import { REELS_PERSONA_LABELS } from "@/lib/ai/modules/reels";
import type { ReelsVariant } from "@/lib/ai/schemas";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Input";
import GeneratingCard from "@/components/ai/GeneratingCard";

const REELS_STATUS_MESSAGES = [
  "Brendni o‘rganmoqda…",
  "Hook yozilmoqda…",
  "Sahnalar tuzilmoqda…",
  "Ovoz matni yozilmoqda…",
  "Caption va CTA tayyorlanmoqda…",
  "Sayqallanmoqda…",
];

const PERSONA_ORDER: ReelsVariant["persona"][] = ["expert", "emotional", "sales"];

type BrandOption = { id: string; name: string };

function assembleScript(v: ReelsVariant): string {
  return [
    `Hook: ${v.hook}`,
    "",
    "Sahnalar:",
    ...v.scenes.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Ovoz matni: ${v.voiceover}`,
    "",
    `Caption: ${v.caption}`,
    `CTA: ${v.cta}`,
    `Davomiylik: ${v.duration}`,
  ].join("\n");
}

export default function ReelsForm({ brands }: { brands: BrandOption[] }) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [product, setProduct] = useState("");
  const [goal, setGoal] = useState<PlanGoal>("engagement");
  const [variants, setVariants] = useState<ReelsVariant[]>([]);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setVariants([]);
    try {
      const res = await fetch("/api/generate/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, topic, product, goal }),
      });
      const json = await res.json();
      if (json.ok) {
        const sorted = [...json.data.variants].sort(
          (a, b) => PERSONA_ORDER.indexOf(a.persona) - PERSONA_ORDER.indexOf(b.persona)
        );
        setVariants(sorted);
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

  async function copyVariant(v: ReelsVariant) {
    await navigator.clipboard.writeText(assembleScript(v));
    setCopied(v.persona);
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
        <label className="block">
          <Label>Mavzu</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            placeholder="Masalan: Yozgi aksiya"
          />
        </label>
        <label className="block">
          <Label>Mahsulot/xizmat</Label>
          <Textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            rows={2}
            placeholder="Masalan: Fitnes abonementi"
          />
        </label>
        <label className="block">
          <Label>Maqsad</Label>
          <Select value={goal} onChange={(e) => setGoal(e.target.value as PlanGoal)}>
            {Object.entries(PLAN_GOAL_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleGenerate}
          disabled={
            loading ||
            !brandId ||
            topic.trim().length < 3 ||
            product.trim().length < 3
          }
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (3 kredit)"}
        </Button>
        {creditsLeft !== null && (
          <p className="text-sm text-muted">Qolgan kreditlar: {creditsLeft}</p>
        )}
      </Card>

      <GeneratingCard active={loading} messages={REELS_STATUS_MESSAGES} />

      {variants.map((v) => (
        <Card key={v.persona} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              {REELS_PERSONA_LABELS[v.persona]}
            </span>
            <button
              onClick={() => copyVariant(v)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {copied === v.persona ? "Nusxalandi ✓" : "Nusxalash"}
            </button>
          </div>
          <p className="text-sm font-medium text-ink">{v.hook}</p>
          <div>
            <p className="text-sm font-medium text-muted">Sahnalar</p>
            <ol className="ml-4 list-decimal space-y-1 text-sm text-ink">
              {v.scenes.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <p className="text-sm text-ink">
            <span className="font-medium text-muted">Ovoz matni: </span>
            {v.voiceover}
          </p>
          <p className="text-sm text-ink">
            <span className="font-medium text-muted">Caption: </span>
            {v.caption}
          </p>
          <p className="text-sm text-ink">
            <span className="font-medium text-muted">CTA: </span>
            {v.cta}
          </p>
          <p className="text-sm text-muted">Davomiylik: {v.duration}</p>
        </Card>
      ))}
    </div>
  );
}
