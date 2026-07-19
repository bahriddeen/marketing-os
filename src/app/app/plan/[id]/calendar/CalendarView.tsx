// src/app/app/plan/[id]/calendar/CalendarView.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMonthDays, formatDateKey, detectDateConflicts } from '@/lib/calendar';
import { bulkShiftDates, bulkUpdateStatus } from '@/app/app/plan/actions';
import CalendarHeader from './CalendarHeader';
import PostCard from './PostCard';
import BulkActionsBar from './BulkActionsBar';
import type { PlanPostRow } from '@/lib/types';
import type { PlanStatus } from '@/lib/plans';

interface CalendarViewProps {
  initialPosts: PlanPostRow[];
  planId: string;
}

export default function CalendarView({ initialPosts, planId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSelectPost = useCallback((postId: string, selected: boolean) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(postId);
      } else {
        next.delete(postId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedPostIds.size === initialPosts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(initialPosts.map((p) => p.id)));
    }
  }, [initialPosts, selectedPostIds]);

  const handleShiftDates = useCallback(
    async (days: number) => {
      if (selectedPostIds.size === 0) return;

      const conflicts = detectDateConflicts(initialPosts, selectedPostIds, days);
      if (conflicts.length > 0) {
        setError(
          `${conflicts.length} ta post boshqa postlar bilan bir sanaga tushib qoladi. Boshqa kun sonini tanlang.`
        );
        return;
      }

      const result = await bulkShiftDates(Array.from(selectedPostIds), days, planId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSelectedPostIds(new Set());
      setError(null);
      router.refresh();
    },
    [selectedPostIds, initialPosts, router, planId]
  );

  const handleChangeStatus = useCallback(
    async (status: PlanStatus) => {
      if (selectedPostIds.size === 0) return;

      const result = await bulkUpdateStatus(Array.from(selectedPostIds), status);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSelectedPostIds(new Set());
      setError(null);
      router.refresh();
    },
    [selectedPostIds, router]
  );

  const postsByDate = new Map<string, PlanPostRow[]>();
  initialPosts.forEach((post) => {
    const key = post.date;
    if (!postsByDate.has(key)) {
      postsByDate.set(key, []);
    }
    postsByDate.get(key)!.push(post);
  });

  const monthGrid = getMonthDays(currentDate);
  const weekDayLabels = ['Yak', 'Du', 'Se', 'Chu', 'Pa', 'Ju', 'Sha'];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded bg-danger-soft p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <CalendarHeader
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />

      <div className="border border-line rounded">
        <div className="grid grid-cols-7 gap-px bg-canvas-soft border-b border-line">
          {weekDayLabels.map((day) => (
            <div key={day} className="bg-canvas p-2 text-center text-xs font-semibold text-muted">
              {day}
            </div>
          ))}
        </div>

        <div className="divide-y divide-line">
          {monthGrid.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 divide-x divide-line">
              {week.map((date, dayIdx) => {
                const dateKey = date ? formatDateKey(date) : null;
                const dayPosts = dateKey ? postsByDate.get(dateKey) || [] : [];
                const isToday =
                  date !== null && formatDateKey(new Date()) === formatDateKey(date);
                const isOutOfMonth = date === null;

                return (
                  <div
                    key={`${weekIdx}-${dayIdx}`}
                    className={`min-h-32 p-2 ${
                      isOutOfMonth
                        ? 'bg-canvas-soft'
                        : isToday
                          ? 'bg-accent-soft'
                          : 'bg-canvas hover:bg-canvas-soft'
                    }`}
                  >
                    {date && (
                      <>
                        <div className={`text-sm font-semibold ${isToday ? 'text-accent' : 'text-muted'}`}>
                          {date.getDate()}
                        </div>
                        <div className="mt-1 space-y-1">
                          {dayPosts.slice(0, 3).map((post) => (
                            <PostCard
                              key={post.id}
                              post={post}
                              isSelected={selectedPostIds.has(post.id)}
                              onSelect={handleSelectPost}
                            />
                          ))}
                          {dayPosts.length > 3 && (
                            <p className="text-xs text-muted">+{dayPosts.length - 3}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <BulkActionsBar
        selectedCount={selectedPostIds.size}
        totalCount={initialPosts.length}
        onSelectAll={handleSelectAll}
        onShiftDates={handleShiftDates}
        onChangeStatus={handleChangeStatus}
        onClear={() => setSelectedPostIds(new Set())}
      />
    </div>
  );
}
