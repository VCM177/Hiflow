'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { RHFDateField } from '@/components/shared/form/rhf-date-field';
import { RHFFileField } from '@/components/shared/form/rhf-file-field';
import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { RHFTextareaField } from '@/components/shared/form/rhf-textarea-field';
import { NotesSection } from '@/components/shared/notes-section';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge, type StatusMap } from '@/components/shared/status-badge';
import { UnsavedChangesGuard } from '@/components/shared/unsaved-changes-guard';
import {
  VerticalTimeline,
  type TimelineItem,
} from '@/components/shared/vertical-timeline';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import { applyApiError } from '@/lib/forms/apply-api-error';
import { cvFileError } from '@/lib/validations';

// Everything below is sample data for looking at the components. Real screens keep their
// status maps in their own `constants.ts` and read their data from the API.
type DemoStatus = 'WAITING' | 'DOING' | 'DONE' | 'FAILED' | 'CLOSED';

const DEMO_STATUS: StatusMap<DemoStatus> = {
  WAITING: { label: 'Chờ xử lý', variant: 'warning' },
  DOING: { label: 'Đang thực hiện', variant: 'primary' },
  DONE: { label: 'Hoàn thành', variant: 'success' },
  FAILED: { label: 'Không đạt', variant: 'destructive' },
  CLOSED: { label: 'Đã đóng', variant: 'neutral' },
};

const TIMELINE: TimelineItem[] = [
  {
    id: 't3',
    title: 'Chuyển sang Phỏng vấn',
    at: '2026-03-03T03:30:00.000Z',
    actor: 'Trần Thị B',
    note: 'Đạt vòng sàng lọc.\nHẹn phỏng vấn tuần sau.',
  },
  {
    id: 't2',
    title: 'Chuyển sang Sàng lọc',
    at: '2026-03-02T08:00:00.000Z',
    actor: 'Nguyễn Văn A',
  },
  { id: 't1', title: 'Nộp hồ sơ', at: '2026-03-01T01:00:00.000Z' },
];

const schema = z.object({
  name: z.string().trim().min(1, { error: 'Vui lòng nhập tên.' }),
  department: z.string().min(1, { error: 'Vui lòng chọn phòng ban.' }),
  startDate: z.string().min(1, { error: 'Vui lòng chọn ngày.' }),
  note: z.string().max(200, { error: 'Tối đa 200 ký tự.' }),
  cv: z
    .custom<File>((value) => value instanceof File, {
      error: 'Vui lòng chọn tệp CV.',
    })
    .superRefine((file, ctx) => {
      const message = cvFileError(file);
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
});
type FormValues = z.infer<typeof schema>;

const DEPARTMENTS = [
  { value: 'eng', label: 'Kỹ thuật' },
  { value: 'hr', label: 'Nhân sự' },
];

function FormDemo() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', department: '', startDate: '', note: '' },
  });

  return (
    <SectionCard
      title="Trường biểu mẫu và chặn rời trang"
      description="Sửa một ô rồi bấm vào liên kết bên dưới để thấy hộp xác nhận."
    >
      <UnsavedChangesGuard dirty={form.formState.isDirty} />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          toast.success(`Đã gửi: ${values.name}`),
        )}
        className="flex max-w-xl flex-col gap-4"
      >
        <RHFTextField control={form.control} name="name" label="Tên" required />
        <RHFSelectField
          control={form.control}
          name="department"
          label="Phòng ban"
          required
          selectProps={{ options: DEPARTMENTS, placeholder: 'Chọn phòng ban' }}
        />
        <RHFDateField
          control={form.control}
          name="startDate"
          label="Ngày bắt đầu"
          required
        />
        <RHFTextareaField
          control={form.control}
          name="note"
          label="Ghi chú"
          hint="Tối đa 200 ký tự."
        />
        <RHFFileField
          control={form.control}
          name="cv"
          label="CV"
          required
          hint="PDF hoặc DOCX, tối đa 5 MB."
          accept=".pdf,.docx"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary">
            Gửi
          </Button>
          <Button
            onClick={() =>
              applyApiError(
                new ApiError(400, ['Tên này không được chấp nhận.']),
                form.setError,
                'name',
              )
            }
          >
            Giả lập lỗi 400 của API ở ô Tên
          </Button>
          <Link
            href="/dev/tokens"
            className="text-sm text-hf-primary underline"
          >
            Xem token
          </Link>
        </div>
      </form>
    </SectionCard>
  );
}

async function saveDemoNote(value: string | null) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (value?.toLowerCase().includes('lỗi')) {
    throw new ApiError(409, [
      'Hồ sơ đã được ẩn danh nên không thể sửa ghi chú.',
    ]);
  }
}

/** A development-only page that shows the form and detail components with sample data. */
export function ComponentGallery() {
  const [note, setNote] = React.useState<string | null>('Ứng viên tiềm năng.');

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Trạng thái">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DEMO_STATUS) as DemoStatus[]).map((status) => (
            <StatusBadge key={status} status={status} map={DEMO_STATUS} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Lịch sử">
        <VerticalTimeline items={TIMELINE} label="Lịch sử trạng thái" />
      </SectionCard>

      <NotesSection
        title="Ghi chú nội bộ"
        value={note}
        canEdit
        maxLength={500}
        onSave={async (value) => {
          await saveDemoNote(value);
          setNote(value);
          toast.success(value === null ? 'Đã xóa ghi chú' : 'Đã lưu ghi chú');
        }}
      />
      <p className="-mt-4 text-xs text-hf-text-muted">
        Gõ chữ &quot;lỗi&quot; rồi lưu để xem lỗi từ API hiện cạnh nút.
      </p>

      <FormDemo />
    </div>
  );
}
