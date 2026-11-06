'use client';

import * as React from 'react';
import { useController, type FieldValues } from 'react-hook-form';

import { Textarea } from '@/components/ui/textarea';

import { FormField } from './form-field';
import type { RHFFieldProps } from './rhf-field-props';

export type RHFTextareaProps = Omit<
  React.ComponentProps<typeof Textarea>,
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

/** A multi-line text field bound to React Hook Form (reasons, notes, descriptions). */
export function RHFTextareaField<TValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  inputProps,
}: RHFFieldProps<TValues> & { inputProps?: RHFTextareaProps }) {
  const { field, fieldState } = useController({ control, name });
  return (
    <FormField
      label={label}
      hint={hint}
      required={required}
      error={fieldState.error?.message}
    >
      {(control) => (
        <Textarea
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
