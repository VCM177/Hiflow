import type { Control, FieldPath, FieldValues } from 'react-hook-form';

/** What every RHF field needs: the form's `control` and the field's name, its label and optional hint. */
export interface RHFFieldProps<TValues extends FieldValues> {
  /** From `useForm`; the values may be parsed into other types (text to numbers) on submit. */
  control: Control<TValues, unknown, FieldValues>;
  name: FieldPath<TValues>;
  label: string;
  hint?: string;
  required?: boolean;
}
