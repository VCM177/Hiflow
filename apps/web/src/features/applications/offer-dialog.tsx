'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { RHFDateField } from '@/components/shared/form/rhf-date-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { RHFTextareaField } from '@/components/shared/form/rhf-textarea-field';
import { FormDialog } from '@/components/shared/form-dialog';

import type { Offer } from './application-api';
import { offerSchema, todayText, type OfferValues } from './offer-schema';

/** Create (`offer` is null) or edit the offer. Only a pending offer can be edited. */
export function OfferDialog({
  offer,
  open,
  onOpenChange,
  onSubmit,
}: {
  offer: Pick<Offer, 'salary' | 'startDate' | 'expiresAt' | 'note'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OfferValues) => Promise<void>;
}) {
  const form = useForm<OfferValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      salary: offer ? String(offer.salary) : '',
      startDate: offer?.startDate.slice(0, 10) ?? '',
      expiresAt: offer?.expiresAt?.slice(0, 10) ?? '',
      note: offer?.note ?? '',
    },
  });
  const today = todayText();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={offer ? 'Sửa đề nghị' : 'Tạo đề nghị'}
      submitLabel={offer ? 'Lưu thay đổi' : 'Tạo đề nghị'}
      form={form}
      onSubmit={onSubmit}
    >
      <RHFTextField
        control={form.control}
        name="salary"
        label="Lương hằng tháng (đồng)"
        required
        hint="Từ 1 đến 10.000.000.000."
        inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
      />
      <RHFDateField
        control={form.control}
        name="startDate"
        label="Ngày nhận việc"
        required
        inputProps={{ min: today }}
      />
      <RHFDateField
        control={form.control}
        name="expiresAt"
        label="Hạn phản hồi"
        hint="Ngày cuối ứng viên có thể trả lời, không sau ngày nhận việc."
        inputProps={{ min: today }}
      />
      <RHFTextareaField
        control={form.control}
        name="note"
        label="Ghi chú"
        inputProps={{ maxLength: 2000, rows: 3 }}
      />
    </FormDialog>
  );
}
