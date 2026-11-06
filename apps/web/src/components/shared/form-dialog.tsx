'use client';

import * as React from 'react';
import type {
  FieldValues,
  SubmitHandler,
  UseFormReturn,
} from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { describeApiError } from '@/lib/api/describe-error';

export interface FormDialogProps<TValues extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The action in words ("Thêm phòng ban", "Lưu thay đổi"), never "OK". */
  submitLabel: string;
  /**
   * The form, created by the caller with `useForm` once its data is ready (a form that
   * edits a record is mounted after the record loaded and given `defaultValues`).
   */
  form: UseFormReturn<TValues>;
  /** Runs with the validated values. A rejection keeps the dialog open and shows beside the button. */
  onSubmit: SubmitHandler<TValues>;
  /** The fields (`RHFTextField`...) built on `form.control`. */
  children: React.ReactNode;
}

/**
 * A dialog around one form. Per the design guide, a dialog reports failures inline next to
 * the confirm button (Zod errors sit on their fields); success closes the dialog and the
 * caller shows the toast. The submit button is locked and the dialog cannot be dismissed
 * while the request runs. Closing, by Hủy or after success, puts the form back to its
 * defaults so the next opening starts clean.
 */
export function FormDialog<TValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  form,
  onSubmit,
  children,
}: FormDialogProps<TValues>) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const { isSubmitting } = form.formState;

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
      setFailure(null);
    }
    onOpenChange(next);
  }

  async function submit(values: TValues, event?: React.BaseSyntheticEvent) {
    setFailure(null);
    try {
      await onSubmit(values, event);
      handleOpenChange(false);
    } catch (error) {
      setFailure(describeApiError(error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" preventDismiss={isSubmitting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-4"
        >
          {children}
          <DialogFooter className="items-center">
            {failure && (
              <p
                role="alert"
                className="text-sm text-hf-destructive-text sm:mr-auto"
              >
                {failure}
              </p>
            )}
            <Button
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
