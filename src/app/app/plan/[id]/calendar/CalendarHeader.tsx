'use client';

import { format, addMonths, subMonths } from 'date-fns';
import { uz } from 'date-fns/locale';
import Button from '@/components/ui/Button';

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export default function CalendarHeader({
  currentDate,
  onDateChange,
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
    </div>
  );
}
