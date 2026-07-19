'use client';

import { format, addMonths, subMonths } from 'date-fns';
import { uz } from 'date-fns/locale';
import Button from '@/components/ui/Button';

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: 'month' | 'week';
  onViewChange: (mode: 'month' | 'week') => void;
}

export default function CalendarHeader({
  currentDate,
  onDateChange,
  viewMode,
  onViewChange,
}: CalendarHeaderProps) {
  const monthYear = format(currentDate, "MMMM yyyy", { locale: uz });

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => onDateChange(subMonths(currentDate, 1))}
          className="px-2 py-1"
        >
          ←
        </Button>
        <div className="min-w-40 text-center">
          <h3 className="text-lg font-semibold text-ink">{monthYear}</h3>
        </div>
        <Button
          variant="secondary"
          onClick={() => onDateChange(addMonths(currentDate, 1))}
          className="px-2 py-1"
        >
          →
        </Button>
        <Button
          variant="secondary"
          onClick={() => onDateChange(new Date())}
          className="ml-2 px-3 py-1 text-sm"
        >
          Bugun
        </Button>
      </div>

      <div className="flex gap-1 rounded border border-line p-1">
        <button
          onClick={() => onViewChange('month')}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            viewMode === 'month'
              ? 'bg-accent text-white'
              : 'text-muted hover:text-ink'
          }`}
        >
          Oy
        </button>
        <button
          onClick={() => onViewChange('week')}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            viewMode === 'week'
              ? 'bg-accent text-white'
              : 'text-muted hover:text-ink'
          }`}
        >
          Hafta
        </button>
      </div>
    </div>
  );
}
