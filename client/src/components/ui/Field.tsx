import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export const inputClasses =
  'h-11 w-full rounded-control border border-border-control bg-surface px-3.5 text-body text-text-primary transition-colors placeholder:text-text-tertiary hover:border-text-tertiary aria-invalid:border-danger aria-invalid:focus-visible:outline-danger disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-disabled';

function FieldMessage({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: string;
}) {
  if (error) {
    return (
      <p id={`${id}-error`} className='text-caption text-danger' role='alert'>
        {error}
      </p>
    );
  }

  if (hint) {
    return (
      <p id={`${id}-hint`} className='text-caption text-text-tertiary'>
        {hint}
      </p>
    );
  }

  return null;
}

function describedBy(id: string, error?: string, hint?: string) {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className='block text-body-sm font-medium text-text-primary'
    >
      {children}
      {required && (
        <span className='ml-0.5 text-danger' aria-hidden='true'>
          *
        </span>
      )}
    </label>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  trailing?: ReactNode;
};

export function TextField({
  id,
  label,
  hint,
  error,
  required,
  className,
  containerClassName,
  trailing,
  ...props
}: TextFieldProps) {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className='relative'>
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(inputClasses, trailing ? 'pr-12' : undefined, className)}
          {...props}
        />
        {trailing && (
          <div className='absolute inset-y-0 right-1 flex items-center'>
            {trailing}
          </div>
        )}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  className,
  containerClassName,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className='relative'>
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(inputClasses, 'appearance-none pr-10', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className='pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary'
          aria-hidden='true'
        />
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export function TextareaField({
  id,
  label,
  hint,
  error,
  required,
  className,
  containerClassName,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(inputClasses, 'h-auto min-h-24 py-3', className)}
        {...props}
      />
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function FormErrorSummary({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;

  return (
    <div
      role='alert'
      tabIndex={-1}
      className={cn(
        'rounded-control border border-danger-border bg-danger-soft px-3.5 py-3 text-body-sm text-danger',
        className
      )}
    >
      {message}
    </div>
  );
}
