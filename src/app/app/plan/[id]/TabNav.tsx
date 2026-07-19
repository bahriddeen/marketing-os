'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function TabNav({ planId }: { planId: string }) {
  const pathname = usePathname();
  const isCalendar = pathname.includes('/calendar');

  return (
    <div className="flex gap-1 border-b border-line bg-canvas">
      <Link
        href={`/app/plan/${planId}`}
        className={`px-4 py-2 border-b-2 transition ${
          !isCalendar
            ? 'border-accent text-accent font-medium'
            : 'border-transparent text-muted hover:text-ink'
        }`}
      >
        Jadval
      </Link>
      <Link
        href={`/app/plan/${planId}/calendar`}
        className={`px-4 py-2 border-b-2 transition ${
          isCalendar
            ? 'border-accent text-accent font-medium'
            : 'border-transparent text-muted hover:text-ink'
        }`}
      >
        Taqvim
      </Link>
    </div>
  );
}
