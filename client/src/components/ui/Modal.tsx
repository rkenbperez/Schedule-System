import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button, IconButton } from './Button';

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-[min(96vw,72rem)]',
} as const;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizeClasses;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal='true'
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-panel border border-border bg-surface p-0 text-text-primary shadow-overlay backdrop:bg-black/40 backdrop:backdrop-blur-[2px]',
        'max-sm:mb-0 max-sm:mt-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        sizeClasses[size],
        className
      )}
    >
      <div className='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:max-h-[92dvh]'>
        <div className='flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5'>
          <div className='min-w-0'>
            <h2 id={titleId} className='text-h2 text-text-primary'>
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className='mt-1 text-body-sm text-text-secondary'
              >
                {description}
              </p>
            )}
          </div>
          <IconButton
            label='Close dialog'
            variant='ghost'
            size='sm'
            onClick={onClose}
            className='-mr-1 -mt-1'
          >
            <X size={18} aria-hidden='true' />
          </IconButton>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5'>
          {children}
        </div>

        {footer && (
          <div className='flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface-tertiary px-4 py-3 sm:flex-row sm:justify-end sm:px-5'>
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size='sm'
      footer={
        <>
          <Button variant='secondary' onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className='text-body text-text-secondary'>{description}</p>
    </Modal>
  );
}
