"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { PLAN_CREDITS, type SubscriptionPlan } from "@/lib/billing";
import { generateCode } from "./actions";

const PLANS: SubscriptionPlan[] = ["starter", "professional", "agency"];

export default function GenerateCodeForm() {
  const router = useRouter();
  const [type, setType] = useState<"subscription" | "topup">("subscription");
  const [plan, setPlan] = useState<SubscriptionPlan>("starter");
  const [credits, setCredits] = useState(50);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res =
        type === "subscription"
          ? await generateCode({ type: "subscription", plan })
          : await generateCode({ type: "topup", credits });
      if (res.ok) {
        setGenerated(res.code);
        setError(null);
        router.refresh();
      } else {
        setGenerated(null);
        setError(res.error);
      }
    });
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-ink">Kod yaratish</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              checked={type === "subscription"}
              onChange={() => setType("subscription")}
            />
            Obuna
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" checked={type === "topup"} onChange={() => setType("topup")} />
            Bir martalik kredit
          </label>
        </div>

        {type === "subscription" ? (
          <div>
            <Label>Tarif</Label>
            <Select value={plan} onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p} ({PLAN_CREDITS[p]} kredit)
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <Label>Kredit miqdori</Label>
            <Input
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value) || 0)}
            />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {generated && (
          <p className="rounded-[0.625rem] bg-accent-soft px-3 py-2.5 font-mono text-lg tracking-wide text-accent">
            {generated}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Yaratilmoqda…" : "Kod yaratish"}
        </Button>
      </form>
    </Card>
  );
}
