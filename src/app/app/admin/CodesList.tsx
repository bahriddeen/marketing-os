"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { voidCode } from "./actions";

export type CodeRow = {
  id: string;
  code: string;
  type: "subscription" | "topup";
  plan: string | null;
  credits: number;
  status: "active" | "redeemed" | "void";
  redeemed_by_email: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<CodeRow["status"], string> = {
  active: "Faol",
  redeemed: "Ishlatilgan",
  void: "Bekor qilingan",
};

export default function CodesList({ codes }: { codes: CodeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onVoid(id: string) {
    startTransition(async () => {
      await voidCode(id);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">Kodlar</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-muted">Kod</th>
              <th className="px-3 py-2 font-medium text-muted">Turi</th>
              <th className="px-3 py-2 font-medium text-muted">Kredit</th>
              <th className="px-3 py-2 font-medium text-muted">Holati</th>
              <th className="px-3 py-2 font-medium text-muted">Ishlatgan</th>
              <th className="w-32 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-mono">{c.code}</td>
                <td className="px-3 py-2">{c.type === "subscription" ? c.plan : "top-up"}</td>
                <td className="px-3 py-2">{c.credits}</td>
                <td className="px-3 py-2">{STATUS_LABELS[c.status]}</td>
                <td className="px-3 py-2">{c.redeemed_by_email ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.status === "active" && (
                    <Button variant="danger" disabled={pending} onClick={() => onVoid(c.id)}>
                      Bekor qilish
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
