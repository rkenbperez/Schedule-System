// components/shared/StatusBadge.tsx
const statusStyles: Record<string, string> = {
  scheduled: 'bg-apple-green-50 text-apple-green-700 border-apple-green-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  unscheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  partially_scheduled: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function StatusBadge({
  status,
}: {
  status: 'scheduled' | 'pending' | 'unscheduled' | 'partially_scheduled' | string;
}) {
  const className = statusStyles[status] || 'bg-surface-secondary text-text-tertiary border-border';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-medium border ${className}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </span>
  );
}
