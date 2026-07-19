'use client';

import type { PlanPostRow } from '@/lib/types';

interface CalendarViewProps {
  initialPosts: PlanPostRow[];
  planId: string;
}

export default function CalendarView({ initialPosts, planId }: CalendarViewProps) {
  return (
    <div className="rounded border border-line p-4 text-sm text-muted">
      Taqvim ko‘rinishi tez orada (post count: {initialPosts.length}, plan: {planId})
    </div>
  );
}
