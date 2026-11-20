// components/shared/ConfirmDialog.tsx
import { X } from 'lucide-react';

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/40 ${isOpen ? '' : 'hidden'}`}
      onClick={onCancel}
    >
      <div
        className='fixed inset-y-0 right-0 z-[100] w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between border-b border-border px-6 py-4'>
          <h2 className='text-sm font-medium text-text-primary'>{title}</h2>
          <button
            type='button'
            onClick={onCancel}
            className='shrink-0 rounded-full p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition'
          >
            <X size={16} />
          </button>
        </div>
        <div className='px-6 py-4'>
          <p className='text-sm text-text-secondary'>{message}</p>
        </div>
        <div className='px-6 py-4 flex justify-end gap-3 bg-surface'>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary transition hover:bg-surface-secondary'
          >
            {cancelText}
          </button>
          <button
            type='button'
            onClick={onConfirm}
            className='rounded-md px-4 py-2 text-[13px] font-medium text-white shadow-sm transition bg-apple-green-600 hover:bg-apple-green-700'
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
