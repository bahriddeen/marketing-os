import { ReactNode } from 'react';

interface PlanLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function PlanLayout({ children, params }: PlanLayoutProps) {
  const { id } = await params;

  // Tab navigation must be client-side for active state detection
  return (
    <div>
      <TabNav planId={id} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

// Client component for tab navigation
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

function TabNav({ planId }: { planId: string }) {
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
        Tarqalib
      </Link>
    </div>
  );
}
