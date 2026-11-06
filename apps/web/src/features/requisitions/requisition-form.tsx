'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserRole } from '@hiflow/shared-types';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { RHFDateField } from '@/components/shared/form/rhf-date-field';
import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { RHFTextareaField } from '@/components/shared/form/rhf-textarea-field';
import { SectionCard } from '@/components/shared/section-card';
import { UnsavedChangesGuard } from '@/components/shared/unsaved-changes-guard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  useDepartmentOptions,
  usePositionOptions,
} from '@/features/catalogs/options';
import { describeApiError } from '@/lib/api/describe-error';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  createRequisition,
  submitRequisition,
  updateRequisition,
  type Requisition,
} from './requisition-api';
import {
  requisitionSchema,
  toRequisitionBody,
  type RequisitionInput,
  type RequisitionOutput,
} from './requisition-schema';

function defaultsOf(requisition: Requisition | null): RequisitionInput {
  return {
    title: requisition?.title ?? '',
    departmentId: requisition?.department?.id ?? '',
    positionId: requisition?.position?.id ?? '',
    quantity: requisition ? String(requisition.quantity) : '',
    reason: requisition?.reason ?? '',
    expectedStartDate: requisition?.expectedStartDate?.slice(0, 10) ?? '',
    budgetMin:
      requisition?.budgetMin != null ? String(requisition.budgetMin) : '',
    budgetMax:
      requisition?.budgetMax != null ? String(requisition.budgetMax) : '',
  };
}

/**
 * The full-page requisition form, for a new one (`requisition` is null) or an edit of a
 * draft or rejected one. The page mounts it once the record is loaded, so the fields start
 * from `defaultValues`. Two buttons: save as a draft, or save and send for approval.
 */
export function RequisitionForm({
  requisition,
}: {
  requisition: Requisition | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const departments = useDepartmentOptions();
  const positions = usePositionOptions();
  const [saved, setSaved] = React.useState(false);
  const [sending, setSending] = React.useState<'draft' | 'submit' | null>(null);
  // A department manager's own department is used by the server: the box is not shown.
  const choosesDepartment =
    requisition === null && user.role !== UserRole.DEPT_MANAGER;

  const form = useForm<RequisitionInput, unknown, RequisitionOutput>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: defaultsOf(requisition),
  });

  async function save(values: RequisitionOutput, thenSubmit: boolean) {
    if (choosesDepartment && !values.departmentId) {
      form.setError('departmentId', {
        type: 'required',
        message: 'Vui lòng chọn phòng ban.',
      });
      form.setFocus('departmentId');
      return;
    }
    setSending(thenSubmit ? 'submit' : 'draft');
    let id = requisition?.id ?? null;
    try {
      if (requisition) {
        await updateRequisition(
          requisition.id,
          toRequisitionBody(values, 'edit'),
        );
      } else {
        const created = await createRequisition({
          ...toRequisitionBody(values, 'create'),
          ...(choosesDepartment ? { departmentId: values.departmentId } : {}),
        });
        id = created.id;
      }
    } catch (error) {
      toast.error(describeApiError(error).message);
      setSending(null);
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('requisition'),
    });
    if (thenSubmit && id) {
      try {
        await submitRequisition(id);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entity('requisition'),
        });
        toast.success('Đã gửi yêu cầu để duyệt');
      } catch (error) {
        // The requisition itself was saved; say so and let the person send it from its page.
        toast.error(
          `Đã lưu nháp nhưng chưa gửi duyệt được: ${describeApiError(error).message}`,
        );
      }
    } else {
      toast.success(requisition ? 'Đã lưu thay đổi' : 'Đã lưu bản nháp');
    }
    setSaved(true);
    router.push(`/requisitions/${id}`);
  }

  const busy = sending !== null;

  return (
    <>
      <UnsavedChangesGuard dirty={form.formState.isDirty && !saved} />
      <PageHeader
        title={
          requisition
            ? `Sửa yêu cầu ${requisition.code}`
            : 'Tạo yêu cầu tuyển dụng'
        }
      />
      <form
        noValidate
        onSubmit={(event) => event.preventDefault()}
        className="flex max-w-3xl flex-col gap-6"
      >
        <SectionCard title="Nội dung yêu cầu">
          <div className="flex flex-col gap-4">
            <RHFTextField
              control={form.control}
              name="title"
              label="Tiêu đề"
              required
              inputProps={{ maxLength: 200, autoComplete: 'off' }}
            />
            {choosesDepartment ? (
              <RHFSelectField
                control={form.control}
                name="departmentId"
                label="Phòng ban"
                required
                selectProps={{
                  options: departments.options,
                  placeholder: 'Chọn phòng ban',
                }}
              />
            ) : (
              requisition?.department && (
                <p className="text-sm text-hf-text-body">
                  <span className="text-hf-text-muted">Phòng ban: </span>
                  {requisition.department.name}
                </p>
              )
            )}
            <RHFSelectField
              control={form.control}
              name="positionId"
              label="Vị trí"
              required
              selectProps={{
                options: positions.options,
                placeholder: 'Chọn vị trí',
              }}
            />
            <RHFTextField
              control={form.control}
              name="quantity"
              label="Số lượng cần tuyển"
              required
              hint="Từ 1 đến 1000."
              inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
            />
            <RHFTextareaField
              control={form.control}
              name="reason"
              label="Lý do tuyển dụng"
              inputProps={{ maxLength: 2000, rows: 4 }}
            />
            <RHFDateField
              control={form.control}
              name="expectedStartDate"
              label="Ngày bắt đầu mong muốn"
            />
          </div>
        </SectionCard>
        <SectionCard
          title="Ngân sách"
          description="Mức lương hằng tháng dự kiến, tính bằng đồng."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <RHFTextField
              control={form.control}
              name="budgetMin"
              label="Tối thiểu"
              inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
            />
            <RHFTextField
              control={form.control}
              name="budgetMax"
              label="Tối đa"
              inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
            />
          </div>
        </SectionCard>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={form.handleSubmit((values) => save(values, false))}
          >
            {sending === 'draft' && <Spinner />}
            {requisition ? 'Lưu thay đổi' : 'Lưu nháp'}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={form.handleSubmit((values) => save(values, true))}
          >
            {sending === 'submit' && <Spinner />}
            Lưu và gửi duyệt
          </Button>
        </div>
      </form>
    </>
  );
}
