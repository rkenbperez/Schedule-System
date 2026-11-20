// components/shared/Toast.tsx - Individual toast item component

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItemProps {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  onDismiss: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-apple-green-50 text-apple-green-700 border border-apple-green-100',
  error: 'bg-red-50 text-red-700 border border-red-100',
  info: 'bg-surface-secondary text-text-primary border border-border',
  warning: 'bg-amber-50 text-amber-700 border border-amber-100',
};

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

export function ToastItem({ type, title, description, onDismiss }: ToastItemProps) {
  const className = typeStyles[type];
  const icon = typeIcons[type];

  return (
    <div className={`fixed top-4 right-4 z-[100] rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-opacity ${className}`} onClick={onDismiss} role='alert'>
      <div className='flex items-start gap-3'>
        <span className='shrink-0 mt-0.5'>{icon}</span>
        <div className='flex-1'>
          <div className='flex items-center gap-1'>
            <span className='font-semibold'>{title}</span>
          </div>
          {description && (
            <div className='text-xs text-text-tertiary mt-0.5'>{description}</div>
          )}
        </div>
        <button type='button' onClick={onDismiss} className='ml-2 text-xs text-text-tertiary hover:text-text-primary'>
          ✕
        </button>
      </div>
    </div>
  );
}
