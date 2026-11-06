'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { InterviewResult } from '@hiflow/shared-types';
import { useForm } from 'react-hook-form';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextareaField } from '@/components/shared/form/rhf-textarea-field';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';

import {
  RESULT_OPTIONS,
  resultSchema,
  toResultBody,
  type ResultValues,
} from './result-schema';

/**
 * The interviewer's verdict. The form checks it, then asks once more: a result cannot be
 * changed afterwards, and it decides whether the application can move to Đề nghị.
 */
export function ResultForm({
  onSubmit,
  onReload,
}: {
  onSubmit: (body: ReturnType<typeof toResultBody>) => Promise<void>;
  /** Reloads the interview when the API says another person already decided it. */
  onReload: () => void;
}) {
  const form = useForm<ResultValues>({
    resolver: zodResolver(resultSchema),
    defaultValues: { result: '', feedback: '' },
  });
  const [pending, setPending] = React.useState<ResultValues | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <SectionCard title="Kết quả phỏng vấn">
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setPending(values);
          setOpen(true);
        })}
        className="flex max-w-xl flex-col gap-4"
      >
        <RHFSelectField
          control={form.control}
          name="result"
          label="Kết quả"
          required
          selectProps={{ options: RESULT_OPTIONS, placeholder: 'Chọn kết quả' }}
        />
        <RHFTextareaField
          control={form.control}
          name="feedback"
          label="Nhận xét"
          hint="Bắt buộc khi không đạt."
          inputProps={{ maxLength: 2000, rows: 5 }}
        />
        <div>
          <Button type="submit" variant="primary">
            Ghi kết quả
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Ghi kết quả phỏng vấn"
        description={
          pending?.result === InterviewResult.FAILED
            ? 'Ghi kết quả Không đạt. Kết quả không thể thay đổi sau khi ghi.'
            : 'Ghi kết quả Đạt. Kết quả không thể thay đổi sau khi ghi.'
        }
        confirmLabel="Ghi kết quả"
        onReload={onReload}
        onConfirm={async () => {
          if (pending) await onSubmit(toResultBody(pending));
        }}
      />
    </SectionCard>
  );
}
