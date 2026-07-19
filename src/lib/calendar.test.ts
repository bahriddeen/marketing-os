import { describe, it, expect } from 'vitest';
import {
  getMonthDays,
  formatDateKey,
  parseDateKey,
  addDays,
  detectDateConflicts,
} from './calendar';
import type { PlanPostRow } from './types';

describe('calendar utilities', () => {
  it('getMonthDays returns 6x7 grid', () => {
    const date = new Date('2026-07-15'); // July 2026
    const grid = getMonthDays(date);
    expect(grid).toHaveLength(6);
    expect(grid.every(row => row.length === 7)).toBe(true);
  });

  it('getMonthDays pads with nulls for out-of-month days', () => {
    const date = new Date('2026-07-15'); // July 1, 2026 is Wednesday
    const grid = getMonthDays(date);
    expect(grid[0][0]).toBeNull(); // Mon
    expect(grid[0][1]).toBeNull(); // Tue
    expect(grid[0][2]).toBeNull(); // Wed before July 1
    expect(grid[0][3]?.getDate()).toBe(1); // Wed = July 1
  });

  it('formatDateKey returns YYYY-MM-DD', () => {
    const date = new Date('2026-07-22');
    expect(formatDateKey(date)).toBe('2026-07-22');
  });

  it('parseDateKey parses YYYY-MM-DD to Date', () => {
    const date = parseDateKey('2026-07-22');
    expect(formatDateKey(date)).toBe('2026-07-22');
  });

  it('addDays shifts date correctly', () => {
    expect(addDays('2026-07-22', 5)).toBe('2026-07-27');
    expect(addDays('2026-07-30', -5)).toBe('2026-07-25');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01'); // Month boundary
  });

  it('detectDateConflicts finds collisions', () => {
    const posts: PlanPostRow[] = [
      { id: '1', date: '2026-07-22', status: 'qoralama' } as any,
      { id: '2', date: '2026-07-24', status: 'qoralama' } as any,
      { id: '3', date: '2026-07-25', status: 'qoralama' } as any,
    ];
    // Shift posts 1 and 2 by +1 day: 1→07-23, 2→07-25 (collides with 3)
    const conflicts = detectDateConflicts(posts, new Set(['1', '2']), 1);
    expect(conflicts).toContain('2'); // post 2 would collide with post 3
  });

  it('detectDateConflicts ignores collisions within selected posts', () => {
    const posts: PlanPostRow[] = [
      { id: '1', date: '2026-07-22', status: 'qoralama' } as any,
      { id: '2', date: '2026-07-24', status: 'qoralama' } as any,
    ];
    // Both selected, shift by +1: no conflict with external posts
    const conflicts = detectDateConflicts(posts, new Set(['1', '2']), 1);
    expect(conflicts).toEqual([]);
  });
});
