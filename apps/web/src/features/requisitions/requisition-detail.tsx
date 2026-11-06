'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS, RequisitionStatus } from '@hiflow/shared-types';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { DetailField } from '@/components/shared/detail-field';
import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  VerticalTimeline,
  type TimelineItem,
} from '@/components/shared/vertical-timeline';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchJobs } from '@/features/jobs/job-api';
import { JOB_STATUS_MAP } from '@/features/jobs/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  REQUISITION_ACTION_PERMISSION as PERMISSION,
  REQUISITION_EVENT_LABEL,
  REQUISITION_STATUS_MAP,
  actionsFor,
  type RequisitionAction,
} from './constants';
import {
  approveRequisition,
  closeRequisition,
  deleteRequisition,
  fetchRequisition,
  fetchRequisitionHistory,
  rejectRequisition,
  submitRequisition,
  type Requisition,
} from './requisition-api';

function budgetText(min: number | null, max: number | null): string {
  if (min === null && max === null) return '—';
  if (max === null) return `Từ ${formatCurrency(min)}`;
  if (min === null) return `Đến ${formatCurrency(max)}`;
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

function RelatedJobs({ requisitionId }: { requisitionId: string }) {
  const { can } = useSession();
  const allowed = can(PERMISSIONS.job.listView);
  const query = useQuery({
    queryKey: queryKeys.list('job', { requisitionId }),
    queryFn: ({ signal }) => fetchJobs({ requisitionId, limit: 50 }, signal),
    enabled: allowed,
  });
  if (!allowed) return null;
  return (
    <SectionCard title="Tin tuyển dụng của yêu cầu này">
      {query.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : query.error ? (
        <p className="text-sm text-hf-destructive-text">
          Không tải được danh sách tin.
        </p>
      ) : query.data.items.length === 0 ? (
        <p className="text-sm text-hf-text-muted">
          Chưa có tin nào được tạo từ yêu cầu này.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {query.data.items.map((job) => (
            <li
              key={job.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <Link
                href={`/jobs/${job.id}`}
                className="font-medium text-hf-primary hover:underline"
              >
                {job.title}
              </Link>
              <span className="flex items-center gap-3">
                <span className="text-hf-text-muted">
                  {job.quantity} vị trí
                </span>
                <StatusBadge status={job.status} map={JOB_STATUS_MAP} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

type Dialog = 'delete' | 'submit' | 'approve' | 'reject' | 'close';

export function RequisitionDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [open, setOpen] = React.useState(false);

  const query = useQuery({
    queryKey: queryKeys.detail('requisition', id),
    queryFn: ({ signal }) => fetchRequisition(id, signal),
  });
  const history = useQuery({
    queryKey: [...queryKeys.detail('requisition', id), 'history'],
    queryFn: ({ signal }) => fetchRequisitionHistory(id, signal),
  });

  if (query.isPending) {
    return <Skeleton className="h-64 w-full max-w-3xl" />;
  }
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const requisition: Requisition = query.data;

  function ask(next: Dialog) {
    setDialog(next);
    setOpen(true);
  }
  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('requisition'),
    });
  }
  const reload = () => void refresh();

  const buttons: Record<RequisitionAction, React.ReactNode> = {
    edit: (
      <Link
        href={`/requisitions/${id}/edit`}
        className={buttonVariants({ variant: 'secondary' })}
      >
        Sửa
      </Link>
    ),
    delete: <Button onClick={() => ask('delete')}>Xóa</Button>,
    submit: (
      <Button variant="primary" onClick={() => ask('submit')}>
        {requisition.status === RequisitionStatus.REJECTED
          ? 'Gửi duyệt lại'
          : 'Gửi duyệt'}
      </Button>
    ),
    approve: (
      <Button variant="primary" onClick={() => ask('approve')}>
        Duyệt yêu cầu
      </Button>
    ),
    reject: <Button onClick={() => ask('reject')}>Từ chối</Button>,
    createJob: (
      <Link
        href={`/jobs/new?requisitionId=${id}`}
        className={buttonVariants({ variant: 'primary' })}
      >
        Tạo tin tuyển dụng
      </Link>
    ),
    close: <Button onClick={() => ask('close')}>Đóng yêu cầu</Button>,
  };

  const timeline: TimelineItem[] = [...(history.data ?? [])]
    .reverse()
    .map((item) => ({
      id: item.id,
      title: REQUISITION_EVENT_LABEL[item.event] ?? item.event,
      at: item.at,
      actor: item.actor?.name || null,
      note: item.note,
    }));

  return (
    <>
      <PageHeader
        title={`${requisition.code} · ${requisition.title}`}
        actions={actionsFor(requisition.status).map((action) => (
          <PermissionGate key={action} permission={PERMISSION[action]}>
            {buttons[action] as React.ReactElement<{ disabled?: boolean }>}
          </PermissionGate>
        ))}
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {requisition.status === RequisitionStatus.REJECTED &&
          requisition.rejectReason && (
            <div
              role="alert"
              className="flex gap-3 rounded-hf-container border border-hf-destructive bg-hf-destructive/10 p-4 text-sm text-hf-destructive-text"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div>
                <p className="font-semibold">Yêu cầu bị từ chối</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {requisition.rejectReason}
                </p>
              </div>
            </div>
          )}
        <SectionCard
          title="Thông tin"
          actions={
            <StatusBadge
              status={requisition.status}
              map={REQUISITION_STATUS_MAP}
            />
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Phòng ban">
              {requisition.department?.name}
            </DetailField>
            <DetailField label="Vị trí">
              {requisition.position?.name}
            </DetailField>
            <DetailField label="Số lượng">{requisition.quantity}</DetailField>
            <DetailField label="Ngày bắt đầu mong muốn">
              {requisition.expectedStartDate
                ? formatDate(requisition.expectedStartDate)
                : null}
            </DetailField>
            <DetailField label="Ngân sách">
              {budgetText(requisition.budgetMin, requisition.budgetMax)}
            </DetailField>
            <DetailField label="Người tạo">
              {requisition.createdBy?.name}
            </DetailField>
            {requisition.approvedBy && (
              <DetailField label="Người duyệt">
                {requisition.approvedBy.name}
                {requisition.approvedAt &&
                  ` · ${formatDateTime(requisition.approvedAt)}`}
              </DetailField>
            )}
            <DetailField label="Lý do tuyển dụng" className="sm:col-span-2">
              {requisition.reason && (
                <span className="whitespace-pre-wrap">
                  {requisition.reason}
                </span>
              )}
            </DetailField>
          </dl>
        </SectionCard>
        <RelatedJobs requisitionId={id} />
        <SectionCard title="Lịch sử">
          {history.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : history.error ? (
            <p className="text-sm text-hf-destructive-text">
              Không tải được lịch sử.
            </p>
          ) : (
            <VerticalTimeline items={timeline} label="Lịch sử yêu cầu" />
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={open && dialog === 'delete'}
        onOpenChange={setOpen}
        title="Xóa yêu cầu"
        description={`Xóa yêu cầu ${requisition.code}? Chỉ xóa được bản nháp và thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa yêu cầu"
        onReload={reload}
        onConfirm={async () => {
          await deleteRequisition(id);
          toast.success(`Đã xóa ${requisition.code}`);
          router.replace('/requisitions');
          // Only the lists: this record's own query would refetch a 404.
          await queryClient.invalidateQueries({
            queryKey: [...queryKeys.entity('requisition'), 'list'],
          });
        }}
      />
      <ConfirmDialog
        open={open && dialog === 'submit'}
        onOpenChange={setOpen}
        title="Gửi duyệt"
        description="Yêu cầu sẽ chuyển sang Chờ duyệt và không sửa được cho đến khi có kết quả."
        confirmLabel="Gửi duyệt"
        onReload={reload}
        onConfirm={async () => {
          await submitRequisition(id);
          await refresh();
          toast.success('Đã gửi yêu cầu để duyệt');
        }}
      />
      <ConfirmDialog
        open={open && dialog === 'approve'}
        onOpenChange={setOpen}
        title="Duyệt yêu cầu"
        description="Sau khi duyệt, bộ phận tuyển dụng có thể tạo tin từ yêu cầu này."
        confirmLabel="Duyệt yêu cầu"
        onReload={reload}
        onConfirm={async () => {
          await approveRequisition(id);
          await refresh();
          toast.success(`Đã duyệt ${requisition.code}`);
        }}
      />
      <ConfirmDialog
        open={open && dialog === 'reject'}
        onOpenChange={setOpen}
        title="Từ chối yêu cầu"
        description="Người tạo sẽ thấy lý do và có thể sửa rồi gửi lại."
        confirmLabel="Từ chối yêu cầu"
        reason={{
          label: 'Lý do từ chối',
          placeholder: 'Nêu lý do để người tạo chỉnh sửa',
        }}
        onReload={reload}
        onConfirm={async (reason) => {
          await rejectRequisition(id, reason ?? '');
          await refresh();
          toast.success(`Đã từ chối ${requisition.code}`);
        }}
      />
      <ConfirmDialog
        open={open && dialog === 'close'}
        onOpenChange={setOpen}
        title="Đóng yêu cầu"
        description="Các tin tuyển dụng của yêu cầu này sẽ tự động đóng và cổng công khai không nhận hồ sơ nữa. Thao tác này không thể hoàn tác."
        confirmLabel="Đóng yêu cầu"
        onReload={reload}
        onConfirm={async () => {
          await closeRequisition(id);
          await refresh();
          toast.success(`Đã đóng ${requisition.code}`);
        }}
      />
    </>
  );
}
