'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { PLAN_STATUS_LABELS } from '@/lib/plans';
import type { PlanStatus } from '@/lib/plans';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onShiftDates: (days: number) => void | Promise<void>;
  onChangeStatus: (status: PlanStatus) => void | Promise<void>;
  onClear: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onShiftDates,
  onChangeStatus,
  onClear,
}: BulkActionsBarProps) {
  const [daysInput, setDaysInput] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShiftDates = async (direction: 'forward' | 'back') => {
    const days = parseInt(daysInput) || 0;
    if (days === 0) {
      setError('Kunlar sonini kiriting.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onShiftDates(direction === 'forward' ? days : -days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xato yuz berdi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as PlanStatus;
    if (!status) return;

    setIsLoading(true);
    setError(null);
    try {
      await onChangeStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xato yuz berdi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedCount === 0) {
    return (
      <div className="flex items-center justify-between border-t border-line bg-canvas-soft p-4">
        <span className="text-sm text-muted">
          {totalCount} ta post mavjud
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-canvas-soft p-4">
      {error && (
        <div className="mb-3 rounded bg-danger-soft p-2 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">
            {selectedCount} / {totalCount} ta postni tanlandi
          </span>
          <Button
            variant="secondary"
            onClick={onSelectAll}
            disabled={isLoading}
            className="px-2 py-1 text-xs"
          >
            {selectedCount === totalCount ? 'Bekor qilish' : 'Hammasini tanlash'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="days-shift" className="text-xs text-muted">
              Kun:
            </label>
            <input
              id="days-shift"
              type="number"
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value)}
              disabled={isLoading}
              className="w-16 rounded border border-line px-2 py-1 text-xs text-ink disabled:bg-canvas-soft"
            />
            <Button
              variant="secondary"
              onClick={() => handleShiftDates('back')}
              disabled={isLoading}
              className="px-2 py-1 text-xs"
            >
              ← Chapga
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleShiftDates('forward')}
              disabled={isLoading}
              className="px-2 py-1 text-xs"
            >
              O‘ngga →
            </Button>
          </div>

          <select
            onChange={handleStatusChange}
            disabled={isLoading}
            defaultValue=""
            className="rounded border border-line px-2 py-1 text-xs text-ink disabled:bg-canvas-soft"
          >
            <option value="">Status o‘zgartiring...</option>
            {Object.entries(PLAN_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            onClick={onClear}
            disabled={isLoading}
            className="px-2 py-1 text-xs"
          >
            Bekor
          </Button>
        </div>
      </div>
    </div>
  );
}
