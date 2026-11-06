'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useUserOptions } from '@/features/users/options';

import { scheduleSchema, type ScheduleValues } from './schedule-schema';

/**
 * Book an interview. A clash with the interviewer's other interviews (60 minutes) and a
 * round that already exists come back as 409 and show here, with the form as it was.
 */
export function ScheduleDialog({
  open,
  onOpenChange,
  onSubmit,
  nextRound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ScheduleValues) => Promise<void>;
  /** The round the server will pick when the box is left blank, shown as the hint. */
  nextRound: number;
}) {
  const interviewers = useUserOptions('INTERVIEWER');
  const form = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { interviewerId: '', scheduledAt: '', round: '' },
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Đặt lịch phỏng vấn"
      description="Giờ nhập theo múi giờ Việt Nam."
      submitLabel="Đặt lịch"
      form={form}
      onSubmit={onSubmit}
    >
      <RHFSelectField
        control={form.control}
        name="interviewerId"
        label="Người phỏng vấn"
        required
        selectProps={{
          options: interviewers.options,
          placeholder: 'Chọn người phỏng vấn',
        }}
      />
      <RHFTextField
        control={form.control}
        name="scheduledAt"
        label="Ngày giờ"
        required
        inputProps={{ type: 'datetime-local' }}
      />
      <RHFTextField
        control={form.control}
        name="round"
        label="Vòng phỏng vấn"
        hint={`Để trống để dùng vòng kế tiếp (vòng ${nextRound}).`}
        inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
      />
    </FormDialog>
  );
}
