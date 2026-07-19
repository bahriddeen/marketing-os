'use client';

import StatusBadge from '@/components/ui/StatusBadge';
import type { PlanPostRow } from '@/lib/types';

interface PostCardProps {
  post: PlanPostRow;
  isSelected: boolean;
  onSelect: (postId: string, selected: boolean) => void;
}

export default function PostCard({
  post,
  isSelected,
  onSelect,
}: PostCardProps) {
  return (
    <div
      className={`cursor-pointer rounded border p-2 text-xs transition ${
        isSelected
          ? 'border-accent bg-accent-soft'
          : 'border-line hover:border-accent hover:bg-accent-soft'
      }`}
      onClick={() => onSelect(post.id, !isSelected)}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink truncate">{post.topic}</p>
          <p className="text-muted text-xs truncate">{post.format}</p>
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(post.id, e.target.checked)}
          className="mt-0.5 cursor-pointer"
        />
      </div>
      <div className="mt-1">
        <StatusBadge status={post.status} />
      </div>
    </div>
  );
}
