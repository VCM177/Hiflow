'use client';

import dynamic from 'next/dynamic';
import {
  useController,
  type Control,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form';

import { FormField } from '@/components/shared/form/form-field';
import { Skeleton } from '@/components/ui/skeleton';

// Tiptap is heavy and only this form needs it: it loads when the form opens.
const RichTextEditor = dynamic(
  () => import('@/components/shared/rich-text-editor'),
  { ssr: false, loading: () => <Skeleton className="h-52 w-full" /> },
);

/** The job description, as a form field bound to the rich text editor. */
export function DescriptionField<TValues extends FieldValues>({
  control,
  name,
}: {
  control: Control<TValues, unknown, FieldValues>;
  name: FieldPath<TValues>;
}) {
  const { field, fieldState } = useController({ control, name });
  return (
    <FormField
      label="Mô tả công việc"
      hint="Hiển thị cho ứng viên trên trang tuyển dụng công khai."
      error={fieldState.error?.message}
    >
      {(props) => (
        <RichTextEditor
          id={props.id}
          aria-describedby={props['aria-describedby']}
          aria-invalid={props['aria-invalid']}
          label="Mô tả công việc"
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );
}
