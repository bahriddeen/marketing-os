"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PLAN_PLATFORMS,
  PLAN_GOAL_LABELS,
  type PlanPlatform,
  type PlanGoal,
} from "@/lib/ai/modules/contentPlan";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Input";
import GeneratingCard from "@/components/ai/GeneratingCard";

const PLAN_STATUS_MESSAGES = [
  "Brendni o‘rganmoqda…",
  "Mavzular tanlanmoqda…",
  "Sanalar taqsimlanmoqda…",
  "Hook va CTA yozilmoqda…",
  "Plan jadvalga terilmoqda…",
  "Sayqallanmoqda…",
];

type BrandOption = { id: string; name: string };

export default function PlanForm({ brands }: { brands: BrandOption[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [platform, setPlatform] = useState<PlanPlatform>("instagram");
  const [goal, setGoal] = useState<PlanGoal>("engagement");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [postCount, setPostCount] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          platform,
          goal,
          postCount,
          periodStart: `${month}-01`,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push(`/app/plan/${json.planId}`);
        return;
      }
      setError(json.error ?? "Xatolik yuz berdi.");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    }
    setLoading(false);
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
            <Label>Platforma</Label>
            <Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlanPlatform)}
            >
              {Object.entries(PLAN_PLATFORMS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <Label>Maqsad</Label>
            <Select
              value={goal}
              onChange={(e) => setGoal(e.target.value as PlanGoal)}
            >
              {Object.entries(PLAN_GOAL_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <Label>Oy</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className="block">
            <Label>Postlar soni</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={postCount}
              onChange={(e) => setPostCount(Number(e.target.value))}
            />
          </label>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          onClick={handleGenerate}
          disabled={
            loading || !brandId || !month || postCount < 1 || postCount > 30
          }
        >
          {loading ? "Generatsiya qilinmoqda…" : "Generatsiya qilish (10 kredit)"}
        </Button>
        {loading && (
          <p className="text-sm text-muted">
            Bu eng katta generatsiya — 1–3 daqiqa vaqt olishi mumkin.
          </p>
        )}
      </Card>
      <GeneratingCard active={loading} messages={PLAN_STATUS_MESSAGES} />
    </div>
  );
}
