"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { PlanPostRow } from "@/lib/types";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";
import { updatePlanPost } from "../actions";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Select, Textarea } from "@/components/ui/Input";

const COLUMNS = ["Sana", "Mavzu", "Format", "Holat", "Hook", "CTA", "Maqsad", ""];

export default function PlanTable({ initialPosts }: { initialPosts: PlanPostRow[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanPostRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(p: PlanPostRow) {
    setEditingId(p.id);
    setDraft(p);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    const next = draft;
    startTransition(async () => {
      const res = await updatePlanPost(next.id, {
        topic: next.topic,
        format: next.format,
        hook: next.hook,
        cta: next.cta,
        goal: next.goal,
      });
      if (res.ok) {
        setPosts((ps) => ps.map((p) => (p.id === next.id ? next : p)));
        cancelEdit();
      } else {
        setError(res.error);
      }
    });
  }

  const set = (field: "topic" | "hook" | "cta" | "goal") => (value: string) =>
    setDraft((d) => (d ? { ...d, [field]: value } : d));

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-[0.625rem] border border-line bg-surface">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {COLUMNS.map((c, i) => (
                <th key={i} className="px-3 py-2.5 font-medium text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p) =>
              editingId === p.id && draft ? (
                <tr key={p.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted">
                    {p.date}
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.topic}
                      onChange={(e) => set("topic")(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={draft.format}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? { ...d, format: e.target.value as PlanPostRow["format"] }
                            : d
                        )
                      }
                    >
                      {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.hook}
                      onChange={(e) => set("hook")(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.cta}
                      onChange={(e) => set("cta")(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      rows={3}
                      value={draft.goal}
                      onChange={(e) => set("goal")(e.target.value)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      <Button onClick={saveEdit} disabled={pending} className="px-3 py-1.5">
                        {pending ? "Saqlanmoqda…" : "Saqlash"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={cancelEdit}
                        disabled={pending}
                        className="px-3 py-1.5"
                      >
                        Bekor qilish
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted">
                    {p.date}
                  </td>
                  <td className="px-3 py-2 text-ink">{p.topic}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {PLAN_FORMAT_LABELS[p.format]}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2 text-ink">{p.hook}</td>
                  <td className="px-3 py-2 text-ink">{p.cta}</td>
                  <td className="px-3 py-2 text-muted">{p.goal}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-left text-sm font-medium text-accent hover:underline"
                      >
                        Tahrirlash
                      </button>
                      <Link
                        href={`/app/plan/post/${p.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Ochish
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
