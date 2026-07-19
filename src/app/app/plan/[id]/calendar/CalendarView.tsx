'use client';

import { useState, useCallback } from 'react';
import { getMonthDays, formatDateKey } from '@/lib/calendar';
import CalendarHeader from './CalendarHeader';
import PostCard from './PostCard';
import BulkActionsBar from './BulkActionsBar';
import type { PlanPostRow } from '@/lib/types';

interface CalendarViewProps {
  initialPosts: PlanPostRow[];
  planId: string;
}

export default function CalendarView({ initialPosts, planId }: CalendarViewProps) {
  const [posts, setPosts] = useState<PlanPostRow[]>(initialPosts);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

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
    if (selectedPostIds.size === posts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(posts.map((p) => p.id)));
    }
  }, [posts, selectedPostIds]);

  const postsByDate = new Map<string, PlanPostRow[]>();
  posts.forEach((post) => {
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
      <CalendarHeader
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        viewMode={viewMode}
        onViewChange={setViewMode}
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
        totalCount={posts.length}
        onSelectAll={handleSelectAll}
        onShiftDates={(days) => {
          console.log('Shift by', days, 'days');
        }}
        onChangeStatus={(status) => {
          console.log('Change status to', status);
        }}
        onClear={() => setSelectedPostIds(new Set())}
      />
    </div>
  );
}
