// components/shared/EmptyState.tsx
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='flex flex-col items-center justify-center py-16 text-text-tertiary text-sm'>
      <div className='mb-3 opacity-50'>{icon}</div>
      <h3 className='text-sm font-medium text-text-primary'>{title}</h3>
      {description && <p className='text-xs text-text-tertiary mt-1'>{description}</p>}
      {action && <div className='mt-4'>{action}</div>}
    </div>
  );
}
