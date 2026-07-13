"use client";
import { useState, useTransition } from "react";
import type { PlanPostRow } from "@/lib/types";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";
import { PLAN_FORMAT_LABELS } from "@/lib/ai/modules/contentPlan";
import { updatePlanPost } from "../../actions";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select, Textarea, Label } from "@/components/ui/Input";

export default function PostForm({ post }: { post: PlanPostRow }) {
  const [topic, setTopic] = useState(post.topic);
  const [format, setFormat] = useState(post.format);
  const [status, setStatus] = useState<PlanStatus>(post.status);
  const [hook, setHook] = useState(post.hook);
  const [cta, setCta] = useState(post.cta);
  const [goal, setGoal] = useState(post.goal);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setSaved(false);
    startTransition(async () => {
      const res = await updatePlanPost(post.id, {
        topic,
        format,
        status,
        hook,
        cta,
        goal,
      });
      if (res.ok) {
        setSaved(true);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card className="space-y-4">
      <label className="block">
        <Label>Mavzu</Label>
        <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <Label>Format</Label>
          <Select
            value={format}
            onChange={(e) => setFormat(e.target.value as PlanPostRow["format"])}
          >
            {Object.entries(PLAN_FORMAT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label>Holat</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as PlanStatus)}
          >
            {Object.entries(PLAN_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="block">
        <Label>Hook</Label>
        <Textarea rows={3} value={hook} onChange={(e) => setHook(e.target.value)} />
      </label>
      <label className="block">
        <Label>CTA</Label>
        <Textarea rows={2} value={cta} onChange={(e) => setCta(e.target.value)} />
      </label>
      <label className="block">
        <Label>Maqsad</Label>
        <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || topic.trim().length === 0}>
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        {saved && <span className="text-sm font-medium text-accent">Saqlandi ✓</span>}
      </div>
    </Card>
  );
}
