import { ReactNode } from 'react';
import TabNav from './TabNav';

interface PlanLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function PlanLayout({ children, params }: PlanLayoutProps) {
  const { id } = await params;

  return (
    <div>
      <TabNav planId={id} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
