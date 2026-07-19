'use client';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onShiftDates: (days: number) => void;
  onChangeStatus: (status: string) => void;
  onClear: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  totalCount,
}: BulkActionsBarProps) {
  return (
    <div className="border-t border-line bg-canvas-soft p-4 text-sm text-muted">
      {selectedCount > 0
        ? `${selectedCount} / ${totalCount} ta post tanlandi (ommaviy amallar tez orada)`
        : `${totalCount} ta post mavjud`}
    </div>
  );
}
