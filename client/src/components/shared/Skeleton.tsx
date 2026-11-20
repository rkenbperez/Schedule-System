// components/shared/Skeleton.tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-secondary ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className='space-y-2'>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className='h-4 rounded-md bg-surface-secondary w-full' />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className='rounded-2xl border border-border bg-surface-secondary p-4 animate-pulse'>
      <div className='flex items-center gap-4 mb-3'>
        <div className='h-8 w-8 rounded-full bg-surface-secondary' />
        <div className='space-y-2'>
          <div className='h-6 w-24 rounded-md bg-surface-secondary' />
          <div className='h-4 w-40 rounded-md bg-surface-secondary' />
        </div>
      </div>
      <div className='space-y-2'>
        <div className='h-4 w-full rounded-md bg-surface-secondary' />
        <div className='h-4 w-3/4 rounded-md bg-surface-secondary' />
      </div>
      <div className='space-y-2'>
        <div className='h-4 w-full rounded-md bg-surface-secondary' />
        <div className='h-4 w-2/3 rounded-md bg-surface-secondary' />
      </div>
    </div>
  );
}
