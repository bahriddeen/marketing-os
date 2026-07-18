"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { calculateTopupPriceUzs } from "@/lib/billing";
import { redeemCode } from "./actions";

function formatUzs(amount: number): string {
  // Intl.NumberFormat("uz-UZ") renders a different thousands separator on
  // the server (Node's ICU data) than in the browser, causing a hydration
  // mismatch. A manual, locale-independent formatter is deterministic.
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " so‘m";
}

export function TopupCalculator() {
  const [credits, setCredits] = useState(50);
  const price = calculateTopupPriceUzs(credits);
  return (
    <div className="space-y-3">
      <div>
        <Label>Nechta kredit kerak?</Label>
        <Input
          type="number"
          min={1}
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value) || 0)}
        />
      </div>
      <p className="text-sm text-muted">
        Narxi: <span className="font-medium text-ink">{formatUzs(price)}</span>
      </p>
    </div>
  );
}

export function RedeemCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await redeemCode(code);
      if (res.ok) {
        setError(null);
        setSuccess(
          res.type === "subscription"
            ? `Tarif faollashtirildi: ${res.plan}, +${res.credits} kredit.`
            : `+${res.credits} kredit qo‘shildi.`
        );
        setCode("");
        router.refresh();
      } else {
        setSuccess(null);
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Kodni kiriting</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="masalan: 3F9A0B21E4"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-accent">{success}</p>}
      <Button type="submit" disabled={pending || code.trim().length === 0}>
        {pending ? "Tekshirilmoqda…" : "Kodni faollashtirish"}
      </Button>
    </form>
  );
}
