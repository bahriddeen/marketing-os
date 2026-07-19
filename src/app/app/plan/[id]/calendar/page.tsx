import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateWorkspace } from '@/lib/workspace';
import CalendarView from './CalendarView';
import type { PlanPostRow } from '@/lib/types';

interface CalendarPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { id: planId } = await params;
  const ws = await getOrCreateWorkspace();

  const supabase = await createClient();

  // Fetch plan
  const { data: plan, error: planError } = await supabase
    .from('content_plans')
    .select('id, title, platform, period_start, post_count')
    .eq('id', planId)
    .eq('workspace_id', ws.id)
    .maybeSingle();

  if (planError || !plan) {
    notFound();
  }

  // Fetch posts
  const { data: postsData, error: postsError } = await supabase
    .from('plan_posts')
    .select('*')
    .eq('plan_id', planId)
    .eq('workspace_id', ws.id)
    .order('date', { ascending: true });

  if (postsError) {
    console.error('Failed to fetch posts:', postsError);
  }

  const posts = (postsData ?? []) as PlanPostRow[];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-2xl font-bold text-ink">{plan.title}</h2>
        <p className="text-sm text-muted">{posts.length} ta post</p>
      </div>
      <CalendarView initialPosts={posts} planId={planId} />
    </div>
  );
}
