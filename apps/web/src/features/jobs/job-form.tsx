'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { SectionCard } from '@/components/shared/section-card';
import { UnsavedChangesGuard } from '@/components/shared/unsaved-changes-guard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api/errors';
import { describeApiError } from '@/lib/api/describe-error';
import { queryKeys } from '@/lib/query/keys';

import { DescriptionField } from './description-field';
import { createJob, updateJob, type Job } from './job-api';
import {
  isHeadcountError,
  jobSchema,
  toJobBody,
  type JobInput,
  type JobOutput,
} from './job-schema';

function defaultsOf(
  job: Job | null,
  requisition: RequisitionChoice | null,
): JobInput {
  return {
    requisitionId: job?.requisition?.id ?? requisition?.id ?? '',
    title: job?.title ?? requisition?.title ?? '',
    quantity: String(job?.quantity ?? requisition?.quantity ?? ''),
    salaryMin: job?.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job?.salaryMax != null ? String(job.salaryMax) : '',
    location: job?.location ?? '',
    description: job?.description ?? '',
  };
}

export interface RequisitionChoice {
  id: string;
  title: string;
  quantity: number;
  label: string;
}

/**
 * The full-page job form. A new job picks an approved requisition (its title and headcount
 * fill in the boxes); an edit shows the requisition it belongs to and cannot move it. The
 * page mounts it once the data is ready.
 */
export function JobForm({
  job,
  requisitions,
  preselected,
}: {
  job: Job | null;
  /** The approved requisitions a new job can be made from. Empty for an edit. */
  requisitions: readonly RequisitionChoice[];
  /** The requisition to start from (`?requisitionId=`), when it is among `requisitions`. */
  preselected: RequisitionChoice | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saved, setSaved] = React.useState(false);
  const form = useForm<JobInput, unknown, JobOutput>({
    resolver: zodResolver(jobSchema),
    defaultValues: defaultsOf(job, preselected),
  });
  const { isSubmitting, isDirty } = form.formState;

  // The requisition the boxes were last filled from. Picking another one refills the title
  // and the headcount, unless the person already changed them to something of their own.
  const filledFrom = React.useRef<RequisitionChoice | null>(preselected);
  function onRequisitionChange(id: string) {
    const choice = requisitions.find((item) => item.id === id);
    if (!choice) return;
    const previous = filledFrom.current;
    const title = form.getValues('title');
    const quantity = form.getValues('quantity');
    if (title === '' || title === previous?.title) {
      form.setValue('title', choice.title);
    }
    if (quantity === '' || quantity === String(previous?.quantity)) {
      form.setValue('quantity', String(choice.quantity));
    }
    filledFrom.current = choice;
  }

  async function onSubmit(values: JobOutput) {
    try {
      const result = job
        ? await updateJob(job.id, toJobBody(values, 'edit'))
        : await createJob({
            ...toJobBody(values, 'create'),
            requisitionId: values.requisitionId,
          });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entity('job'),
      });
      toast.success(job ? 'Đã lưu thay đổi' : 'Đã tạo tin tuyển dụng');
      setSaved(true);
      router.push(`/jobs/${result.id}`);
    } catch (error) {
      const message = describeApiError(error).message;
      if (
        error instanceof ApiError &&
        isHeadcountError(error.messages[0] ?? '')
      ) {
        form.setError(
          'quantity',
          { type: 'server', message: error.messages[0] },
          { shouldFocus: true },
        );
      } else {
        toast.error(message);
      }
    }
  }

  return (
    <>
      <UnsavedChangesGuard dirty={isDirty && !saved} />
      <PageHeader title={job ? 'Sửa tin tuyển dụng' : 'Tạo tin tuyển dụng'} />
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex max-w-3xl flex-col gap-6"
      >
        <SectionCard title="Thông tin tin tuyển dụng">
          <div className="flex flex-col gap-4">
            {job ? (
              <p className="text-sm text-hf-text-body">
                <span className="text-hf-text-muted">Yêu cầu: </span>
                {job.requisition?.code}
              </p>
            ) : (
              <RHFSelectField
                control={form.control}
                name="requisitionId"
                label="Yêu cầu tuyển dụng"
                required
                hint="Chỉ các yêu cầu đã duyệt."
                selectProps={{
                  options: requisitions.map((item) => ({
                    value: item.id,
                    label: item.label,
                  })),
                  placeholder: 'Chọn yêu cầu đã duyệt',
                  onValueChange: onRequisitionChange,
                }}
              />
            )}
            <RHFTextField
              control={form.control}
              name="title"
              label="Tiêu đề"
              required
              inputProps={{ maxLength: 200, autoComplete: 'off' }}
            />
            <RHFTextField
              control={form.control}
              name="quantity"
              label="Số lượng cần tuyển"
              required
              hint="Tổng các tin còn hiệu lực của một yêu cầu không vượt số đã duyệt."
              inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
            />
            <RHFTextField
              control={form.control}
              name="location"
              label="Địa điểm làm việc"
              inputProps={{ maxLength: 200, autoComplete: 'off' }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <RHFTextField
                control={form.control}
                name="salaryMin"
                label="Lương tối thiểu"
                hint="Đồng mỗi tháng. Để trống nếu thỏa thuận."
                inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
              />
              <RHFTextField
                control={form.control}
                name="salaryMax"
                label="Lương tối đa"
                inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
              />
            </div>
            <DescriptionField control={form.control} name="description" />
          </div>
        </SectionCard>
        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {job ? 'Lưu thay đổi' : 'Tạo tin'}
          </Button>
        </div>
      </form>
    </>
  );
}
