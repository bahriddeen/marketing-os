import { format, parse, addDays as dateAddDays, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import type { PlanPostRow } from './types';

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateKey(dateStr: string): Date {
  return parse(dateStr, 'yyyy-MM-dd', new Date());
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateKey(dateStr);
  const shifted = dateAddDays(date, days);
  return formatDateKey(shifted);
}

export function getMonthDays(date: Date): (Date | null)[][] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday = 0
  let calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Ensure 6 weeks (42 days) for consistent calendar layout
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  if (allDays.length < 42) {
    calendarEnd = dateAddDays(calendarEnd, 42 - allDays.length);
  }

  const finalDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const grid: (Date | null)[][] = [];
  for (let i = 0; i < finalDays.length; i += 7) {
    const week = finalDays.slice(i, i + 7).map((d) => {
      // Mark days outside the current month as null
      if (d.getMonth() !== monthStart.getMonth()) {
        return null;
      }
      return d;
    });
    grid.push(week);
  }

  return grid;
}

export function detectDateConflicts(
  posts: PlanPostRow[],
  selectedIds: Set<string>,
  shiftDays: number
): string[] {
  if (shiftDays === 0) return [];

  const selectedPosts = posts.filter((p) => selectedIds.has(p.id));
  const unselectedPostDates = new Set(
    posts
      .filter((p) => !selectedIds.has(p.id))
      .map((p) => p.date)
  );

  const conflicts: string[] = [];

  selectedPosts.forEach((post) => {
    const newDate = addDays(post.date, shiftDays);
    if (unselectedPostDates.has(newDate)) {
      conflicts.push(post.id);
    }
  });

  return conflicts;
}
