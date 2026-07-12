import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plans";

const TONES: Record<PlanStatus, string> = {
  qoralama: "bg-canvas text-muted",
  jarayonda: "bg-info-soft text-info",
  tayyor: "bg-warn-soft text-warn",
  elon_qilingan: "bg-accent-soft text-accent",
};

export default function StatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs font-medium ${TONES[status]}`}
    >
      {PLAN_STATUS_LABELS[status]}
    </span>
  );
}
