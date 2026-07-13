"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { buildTableQuery, type TableParams } from "@/lib/planTable";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";
import { PLAN_FORMAT_LABELS, type PlanPlatform } from "@/lib/ai/modules/contentPlan";
import { bulkUpdateStatus } from "./actions";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Select } from "@/components/ui/Input";

export type DashboardPost = {
  id: string;
  date: string;
  topic: string;
  hook: string;
  format: "post" | "carousel" | "reels" | "story";
  status: PlanStatus;
  plan_id: string;
  content_plans: { title: string; platform: PlanPlatform } | null;
  brands: { name: string } | null;
};

function SortHeader({
  label,
  field,
  params,
}: {
  label: string;
  field: TableParams["sort"];
  params: TableParams;
}) {
  const active = params.sort === field;
  const nextDir = active && params.dir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={`/app/plan${buildTableQuery(params, { sort: field, dir: nextDir, page: 1 })}`}
      className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
    >
      {label}
      {active &&
        (params.dir === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
    </Link>
  );
}

export default function PostsTable({
  posts,
  params,
}: {
  posts: DashboardPost[];
  params: TableParams;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<PlanStatus>("tayyor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = posts.length > 0 && posts.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulk() {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateStatus(ids, bulkStatus);
      if (res.ok) {
        setSelected(new Set());
        setError(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[0.625rem] border border-line bg-accent-soft px-4 py-2.5">
          <span className="text-sm font-medium text-ink">
            {selected.size} ta tanlandi
          </span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PlanStatus)}
            className="w-auto!"
            aria-label="Yangi holat"
          >
            {Object.entries(PLAN_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          <Button onClick={applyBulk} disabled={pending} className="px-3 py-1.5">
            {pending ? "Saqlanmoqda…" : "Qo‘llash"}
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            aria-label="Tanlovni bekor qilish"
            className="ml-auto text-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Barchasini tanlash"
                  className="accent-[var(--accent)]"
                />
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted">
                <SortHeader label="Sana" field="date" params={params} />
              </th>
              <th className="px-3 py-2.5 font-medium text-muted">
                <SortHeader label="Mavzu" field="topic" params={params} />
              </th>
              <th className="px-3 py-2.5 font-medium text-muted">Format</th>
              <th className="px-3 py-2.5 font-medium text-muted">Holat</th>
              <th className="hidden px-3 py-2.5 font-medium text-muted md:table-cell">
                Brend
              </th>
              <th className="hidden px-3 py-2.5 font-medium text-muted md:table-cell">
                Plan
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/app/plan/post/${p.id}`)}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-canvas"
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label="Tanlash"
                    className="accent-[var(--accent)]"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-muted">
                  {p.date}
                </td>
                <td className="max-w-96 px-3 py-2.5">
                  <p className="truncate font-medium text-ink">{p.topic}</p>
                  <p className="truncate text-xs text-muted">{p.hook}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                  {PLAN_FORMAT_LABELS[p.format]}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge status={p.status} />
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted md:table-cell">
                  {p.brands?.name ?? "—"}
                </td>
                <td
                  className="hidden max-w-48 px-3 py-2.5 md:table-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/app/plan/${p.plan_id}`}
                    className="block truncate font-medium text-accent hover:underline"
                  >
                    {p.content_plans?.title ?? "—"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
