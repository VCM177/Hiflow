'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CandidateSource } from '@hiflow/shared-types';
import { useForm } from 'react-hook-form';

import { RHFDateField } from '@/components/shared/form/rhf-date-field';
import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { RHFTextareaField } from '@/components/shared/form/rhf-textarea-field';
import { FormDialog } from '@/components/shared/form-dialog';

import type { Candidate } from './candidate-api';
import { candidateSchema, type CandidateValues } from './candidate-schema';
import { SOURCE_OPTIONS } from './constants';

/**
 * Create (`candidate` is null) or edit a candidate. The note is part of creating only: an
 * existing note is changed from the detail page, which has its own permission.
 */
export function CandidateFormDialog({
  candidate,
  open,
  onOpenChange,
  onSubmit,
}: {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CandidateValues) => Promise<void>;
}) {
  const form = useForm<CandidateValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      fullName: candidate?.fullName ?? '',
      email: candidate?.email ?? '',
      phone: candidate?.phone ?? '',
      dob: candidate?.dob?.slice(0, 10) ?? '',
      source: candidate?.source ?? CandidateSource.OTHER,
      note: '',
    },
  });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={candidate ? 'Sửa ứng viên' : 'Thêm ứng viên'}
      submitLabel={candidate ? 'Lưu thay đổi' : 'Thêm ứng viên'}
      form={form}
      onSubmit={onSubmit}
    >
      <RHFTextField
        control={form.control}
        name="fullName"
        label="Họ và tên"
        required
        inputProps={{ maxLength: 100, autoComplete: 'off' }}
      />
      <RHFTextField
        control={form.control}
        name="email"
        label="Email"
        required
        inputProps={{ type: 'email', maxLength: 150, autoComplete: 'off' }}
      />
      <RHFTextField
        control={form.control}
        name="phone"
        label="Số điện thoại"
        inputProps={{ type: 'tel', autoComplete: 'off' }}
      />
      <RHFDateField
        control={form.control}
        name="dob"
        label="Ngày sinh"
        hint="Ứng viên phải từ 16 tuổi."
        inputProps={{ max: today }}
      />
      <RHFSelectField
        control={form.control}
        name="source"
        label="Nguồn"
        required
        selectProps={{ options: SOURCE_OPTIONS }}
      />
      {!candidate && (
        <RHFTextareaField
          control={form.control}
          name="note"
          label="Ghi chú"
          inputProps={{ maxLength: 2000, rows: 3 }}
        />
      )}
    </FormDialog>
  );
}
