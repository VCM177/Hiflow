'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserRole, JobStatus } from '@hiflow/shared-types';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextareaField } from '@/components/shared/form/rhf-textarea-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { Input } from '@/components/ui/input';
import { fetchCandidates } from '@/features/candidates/candidate-api';
import { fetchJobs } from '@/features/jobs/job-api';
import { useUserOptions } from '@/features/users/options';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

const NO_ASSIGNEE = 'none';

const createSchema = z.object({
  candidateId: z.string().min(1, { error: 'Vui lòng chọn ứng viên.' }),
  jobId: z.string().min(1, { error: 'Vui lòng chọn tin tuyển dụng.' }),
  assigneeId: z.string(),
  note: z.string().trim().max(2000, { error: 'Ghi chú tối đa 2000 ký tự.' }),
});
export type CreateApplicationValues = z.infer<typeof createSchema>;

/** The body for `POST /applications`: blanks and "no assignee" are left out. */
export function toCreateBody(values: CreateApplicationValues) {
  return {
    candidateId: values.candidateId,
    jobId: values.jobId,
    ...(values.assigneeId && values.assigneeId !== NO_ASSIGNEE
      ? { assigneeId: values.assigneeId }
      : {}),
    ...(values.note ? { note: values.note } : {}),
  };
}

/**
 * Add a candidate to an open job by hand. The candidate is found by typing part of the
 * name or email; the job list has only jobs that take applications; the owner starts as
 * the signed-in recruiter. Applying twice to one job is a 409 shown in the dialog.
 */
export function ApplicationCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  candidateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateApplicationValues) => Promise<void>;
  /** A candidate chosen in advance (from the candidate page). */
  candidateId?: string;
}) {
  const { user } = useSession();
  const assignees = useUserOptions('ASSIGNEE');
  const [term, setTerm] = React.useState('');
  const search = useDebouncedValue(term.trim(), 300);

  const candidates = useQuery({
    queryKey: queryKeys.options('candidate', { search }),
    queryFn: ({ signal }) =>
      fetchCandidates(
        { search, limit: 20, sortBy: 'fullName', sortDir: 'asc' },
        signal,
      ),
    enabled: open,
  });
  const jobs = useQuery({
    queryKey: queryKeys.options('job', { status: JobStatus.OPEN }),
    queryFn: ({ signal }) =>
      fetchJobs(
        { status: JobStatus.OPEN, limit: 100, sortBy: 'title', sortDir: 'asc' },
        signal,
      ),
    enabled: open,
  });

  const form = useForm<CreateApplicationValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      candidateId: candidateId ?? '',
      jobId: '',
      assigneeId: user.role === UserRole.RECRUITER ? user.id : NO_ASSIGNEE,
      note: '',
    },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Thêm hồ sơ ứng tuyển"
      submitLabel="Thêm hồ sơ"
      form={form}
      onSubmit={onSubmit}
    >
      {!candidateId && (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
            Tìm ứng viên
            <Input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Gõ tên hoặc email"
              autoComplete="off"
            />
          </label>
          <RHFSelectField
            control={form.control}
            name="candidateId"
            label="Ứng viên"
            required
            selectProps={{
              options: (candidates.data?.items ?? []).map((item) => ({
                value: item.id,
                label: `${item.fullName} · ${item.email}`,
              })),
              placeholder: candidates.isPending
                ? 'Đang tải...'
                : 'Chọn ứng viên',
            }}
          />
        </>
      )}
      <RHFSelectField
        control={form.control}
        name="jobId"
        label="Tin tuyển dụng"
        required
        hint="Chỉ các tin đang tuyển."
        selectProps={{
          options: (jobs.data?.items ?? []).map((item) => ({
            value: item.id,
            label: item.title,
          })),
          placeholder: jobs.isPending ? 'Đang tải...' : 'Chọn tin đang tuyển',
        }}
      />
      <RHFSelectField
        control={form.control}
        name="assigneeId"
        label="Người phụ trách"
        selectProps={{
          options: [
            { value: NO_ASSIGNEE, label: 'Chưa phân công' },
            ...assignees.options,
          ],
        }}
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
