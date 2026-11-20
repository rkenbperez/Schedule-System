// components/shared/ModeBadge.tsx
const modeStyles: Record<string, string> = {
  synchronous: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  laboratory: 'bg-amber-50 text-amber-700 border-amber-200',
  asynchronous: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function ModeBadge({
  mode,
}: {
  mode: 'sync' | 'lab' | 'async' | 'Synchronous' | 'Laboratory' | 'Asynchronous' | string | null | undefined;
}) {
  if (!mode) return null;
  const key = mode.toLowerCase();
  const className = modeStyles[key] || 'bg-surface-secondary text-text-tertiary border-border';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium border ${className}`}>
      {mode.charAt(0).toUpperCase() + mode.slice(1)}
    </span>
  );
}
