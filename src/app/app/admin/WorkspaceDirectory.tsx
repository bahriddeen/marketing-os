"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { addCredit } from "./actions";

export type WorkspaceRow = {
  id: string;
  owner_email: string | null;
  plan: string;
  balance: number;
};

export default function WorkspaceDirectory({ workspaces }: { workspaces: WorkspaceRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => (w.owner_email ?? "").toLowerCase().includes(q));
  }, [query, workspaces]);

  function onAdd(workspaceId: string) {
    const amount = amounts[workspaceId] ?? 0;
    if (!amount) return;
    startTransition(async () => {
      await addCredit(workspaceId, amount, "admin panel");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">Ish maydonlari</h2>
      <Input
        placeholder="Email bo‘yicha qidirish"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-muted">Email</th>
              <th className="px-3 py-2 font-medium text-muted">Tarif</th>
              <th className="px-3 py-2 font-medium text-muted">Balans</th>
              <th className="w-48 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{w.owner_email ?? "—"}</td>
                <td className="px-3 py-2">{w.plan}</td>
                <td className="px-3 py-2 font-mono">{w.balance}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      value={amounts[w.id] ?? ""}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [w.id]: Number(e.target.value) || 0 }))
                      }
                    />
                    <Button variant="secondary" disabled={pending} onClick={() => onAdd(w.id)}>
                      Qo‘shish
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
