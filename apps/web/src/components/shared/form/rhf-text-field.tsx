'use client';

import * as React from 'react';
import { useController, type FieldValues } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import { FormField } from './form-field';
import type { RHFFieldProps } from './rhf-field-props';

/** Native input attributes a field may set (`type`, `placeholder`, `autoComplete`, `min`...), minus what the form owns. */
export type RHFInputProps = Omit<
  React.ComponentProps<typeof Input>,
  | 'id'
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'ref'
  | 'aria-invalid'
  | 'aria-describedby'
>;

/**
 * A single-line text field bound to React Hook Form. The error shown is the form's: Zod's
 * message, or the API's after `applyApiError`.
 */
export function RHFTextField<TValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  inputProps,
}: RHFFieldProps<TValues> & { inputProps?: RHFInputProps }) {
  const { field, fieldState } = useController({ control, name });
  return (
    <FormField
      label={label}
      hint={hint}
      required={required}
      error={fieldState.error?.message}
    >
      {(control) => (
        <Input
          {...inputProps}
          {...control}
          name={field.name}
          ref={field.ref}
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      )}
    </FormField>
  );
}
