'use client';

import { useController, type FieldValues } from 'react-hook-form';

import { FileInput } from '@/components/ui/file-input';

import { FormField } from './form-field';
import type { RHFFieldProps } from './rhf-field-props';

/**
 * A file field bound to React Hook Form. The form holds the chosen `File` (or null), so a
 * Zod rule such as `cvFileError` checks type and size before anything is sent; a 413 from
 * the API lands here through `applyApiError`.
 */
export function RHFFileField<TValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  accept,
}: RHFFieldProps<TValues> & {
  /** The extensions the browser's picker offers, e.g. ".pdf,.docx". */
  accept?: string;
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <FormField
      label={label}
      hint={hint}
      required={required}
      error={fieldState.error?.message}
    >
      {(control) => (
        <FileInput
          {...control}
          name={field.name}
          ref={field.ref}
          accept={accept}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
        />
      )}
    </FormField>
  );
}
