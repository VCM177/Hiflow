import * as React from 'react';
import { AlertCircle } from 'lucide-react';

/** What a control inside a `FormField` must receive so the label, hint and error reach screen readers. */
export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
  'aria-describedby'?: string;
}

/**
 * The frame around one form control: the label above it (a placeholder is never the
 * label), an optional hint, and the error with an icon and text under it. The control is
 * built by `children` from the ids and ARIA attributes it must carry.
 */
export function FormField({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-hf-text-heading">
        {label}
        {required && (
          <span aria-hidden="true" className="text-hf-destructive-text">
            {' '}
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-hf-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="flex items-center gap-1 text-sm text-hf-destructive-text"
        >
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
