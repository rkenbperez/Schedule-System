// components/shared/SectionHeader.tsx
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='flex items-center justify-between mb-6'>
      <div>
        <h2 className='text-sm font-medium text-text-primary'>{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
