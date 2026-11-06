import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import {
  describeApiError,
  type ErrorPresentation,
} from '@/lib/api/describe-error';

/**
 * Shows a failed request on a form. When the API tied the error to one field (a 400 or
 * 413 and the caller named the field) the message goes on that field, next to the
 * message Zod would have shown, and the field is focused. Every other case is returned
 * untouched for the caller to put where its form type says: a dialog shows it beside the
 * confirm button, a full-page form raises a toast.
 */
export function applyApiError<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  field?: FieldPath<TValues>,
): ErrorPresentation {
  const presentation = describeApiError(error, { field });
  if (presentation.kind === 'field') {
    setError(
      presentation.field as FieldPath<TValues>,
      { type: 'server', message: presentation.message },
      { shouldFocus: true },
    );
  }
  return presentation;
}
