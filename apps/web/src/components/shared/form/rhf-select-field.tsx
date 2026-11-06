'use client';

import { useController, type FieldValues } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { FormField } from './form-field';
import type { RHFFieldProps } from './rhf-field-props';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A choice from a short list, bound to React Hook Form. The form holds the option's
 * `value` (an id or an enum value); an empty string means nothing chosen yet.
 */
export function RHFSelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  selectProps,
}: RHFFieldProps<TValues> & {
  selectProps: {
    options: readonly SelectOption[];
    placeholder?: string;
    disabled?: boolean;
  };
}) {
  const { field, fieldState } = useController({ control, name });
  const { options, placeholder = 'Chọn...', disabled } = selectProps;
  return (
    <FormField
      label={label}
      hint={hint}
      required={required}
      error={fieldState.error?.message}
    >
      {(control) => (
        <Select
          name={field.name}
          value={(field.value as string | undefined) ?? ''}
          onValueChange={field.onChange}
          disabled={disabled}
        >
          <SelectTrigger {...control} ref={field.ref} onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
