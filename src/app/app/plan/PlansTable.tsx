"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  buildPlansQuery,
  pageItems,
  PLAN_PAGE_SIZES,
  type PlansParams,
} from "@/lib/plansTable";
import { deletePlan } from "./actions";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

export type PlanRow = {
  id: string;
  title: string;
  period_start: string;
  post_count: number;
  brands: { name: string } | null;
};

export default function PlansTable({
  plans,
  params,
  total,
}: {
  plans: PlanRow[];
  params: PlansParams;
  total: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const from = (params.page - 1) * params.size;
  const last = Math.max(1, Math.ceil(total / params.size));

  function onDelete() {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    startTransition(async () => {
      const res = await deletePlan(id);
      if (res.ok) {
        setConfirmTarget(null);
        toast.show("Plan o‘chirildi.", "success");
        router.refresh();
      } else {
        toast.show(res.error, "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-2.5 font-medium text-muted">Plan</th>
              <th className="hidden px-4 py-2.5 font-medium text-muted md:table-cell">
                Brend
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 font-medium text-muted">
                Postlar
              </th>
              <th className="w-28 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/app/plan/${p.id}`)}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-canvas"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="font-mono text-xs text-muted">
                    {p.period_start.slice(0, 7)}
                  </p>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted md:table-cell">
                  {p.brands?.name ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {p.post_count} ta post
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex items-center gap-3">
                    <Link
                      href={`/app/plan/${p.id}`}
                      aria-label="Tahrirlash"
                      className="rounded text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      onClick={() => setConfirmTarget({ id: p.id, title: p.title })}
                      aria-label="O‘chirish"
                      className="rounded text-muted transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span className="font-mono tabular-nums">
          Natijalar: {from + 1}–{Math.min(from + params.size, total)} / {total}
        </span>
        <div className="flex items-center gap-1">
          {params.page > 1 ? (
            <Link href={`/app/plan${buildPlansQuery(params, { page: params.page - 1 })}`}>
              <Button variant="ghost" className="px-2 py-1.5" aria-label="Oldingi">
                ‹
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" disabled className="px-2 py-1.5" aria-label="Oldingi">
              ‹
            </Button>
          )}
          {pageItems(params.page, last).map((item, i) =>
            item === "…" ? (
              <span key={`e${i}`} className="px-1.5">
                …
              </span>
            ) : item === params.page ? (
              <span
                key={item}
                aria-current="page"
                className="flex h-8 min-w-8 items-center justify-center rounded-[0.625rem] bg-accent px-2 font-medium text-white"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={`/app/plan${buildPlansQuery(params, { page: item })}`}
                className="flex h-8 min-w-8 items-center justify-center rounded-[0.625rem] px-2 text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                {item}
              </Link>
            )
          )}
          {params.page < last ? (
            <Link href={`/app/plan${buildPlansQuery(params, { page: params.page + 1 })}`}>
              <Button variant="ghost" className="px-2 py-1.5" aria-label="Keyingi">
                ›
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" disabled className="px-2 py-1.5" aria-label="Keyingi">
              ›
            </Button>
          )}
          <Select
            value={String(params.size)}
            onChange={(e) =>
              startTransition(() =>
                router.replace(
                  `/app/plan${buildPlansQuery(params, { size: Number(e.target.value), page: 1 })}`
                )
              )
            }
            className="ml-2 w-auto!"
            aria-label="Sahifa hajmi"
          >
            {PLAN_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmTarget}
        title="Planni o‘chirish"
        description={
          confirmTarget
            ? `"${confirmTarget.title}" planini o‘chirmoqchimisiz? Bu amalni ortga qaytarib bo‘lmaydi.`
            : ""
        }
        confirmLabel="Ha, o‘chirish"
        cancelLabel="Bekor qilish"
        onConfirm={onDelete}
        onCancel={() => setConfirmTarget(null)}
        pending={pending}
      />
    </div>
  );
}
