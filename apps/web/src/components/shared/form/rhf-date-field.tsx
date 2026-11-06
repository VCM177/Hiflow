'use client';

import type { FieldValues } from 'react-hook-form';

import type { RHFFieldProps } from './rhf-field-props';
import { RHFTextField, type RHFInputProps } from './rhf-text-field';

/**
 * A date field. The value is the `yyyy-MM-dd` text of the browser's date input, which
 * Zod checks (`ngày phỏng vấn`, `tuổi tối thiểu`...); `min` and `max` go in `inputProps`.
 */
export function RHFDateField<TValues extends FieldValues>({
  inputProps,
  ...field
}: RHFFieldProps<TValues> & { inputProps?: Omit<RHFInputProps, 'type'> }) {
  return (
    <RHFTextField {...field} inputProps={{ ...inputProps, type: 'date' }} />
  );
}
