'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { DetailField } from '@/components/shared/detail-field';
import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ListPagination } from '@/components/shared/list-pagination';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { APPLICATION_STATUS_MAP } from '@/features/applications/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

import {
  JOB_ACTION_PERMISSION as PERMISSION,
  JOB_STATUS_MAP,
  jobActionsFor,
  type JobAction,
} from './constants';
import { JobDescription } from './job-description';
import {
  deleteJob,
  fetchJob,
  fetchJobApplications,
  publishJob,
  stopJob,
  type Job,
  type JobApplication,
} from './job-api';

function salaryText(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Thỏa thuận';
  if (max === null) return `Từ ${formatCurrency(min)}`;
  if (min === null) return `Đến ${formatCurrency(max)}`;
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

const PAGE_SIZE = 10;

const APPLICATION_COLUMNS: DataColumn<JobApplication>[] = [
  {
    id: 'candidate',
    header: 'Ứng viên',
    cell: (item) => (
      <span className="font-medium">{item.candidate?.fullName ?? '—'}</span>
    ),
  },
  {
    id: 'email',
    header: 'Email',
    cell: (item) => item.candidate?.email ?? '—',
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (item) => (
      <StatusBadge status={item.status} map={APPLICATION_STATUS_MAP} />
    ),
  },
  {
    id: 'appliedAt',
    header: 'Ngày nộp',
    cell: (item) => formatDate(item.appliedAt),
  },
  {
    id: 'assignee',
    header: 'Phụ trách',
    cell: (item) => item.assignee?.name ?? '—',
  },
];

function JobApplications({ jobId }: { jobId: string }) {
  const [page, setPage] = React.useState(1);
  const query = useQuery({
    queryKey: queryKeys.list('application', { jobId, page, limit: PAGE_SIZE }),
    queryFn: ({ signal }) =>
      fetchJobApplications(jobId, { page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
  const meta = query.data?.meta;
  return (
    <SectionCard flush>
      <DataTable
        caption="Hồ sơ đã nộp cho tin này"
        columns={APPLICATION_COLUMNS}
        rows={query.data?.items ?? []}
        getRowKey={(item) => item.id}
        state={{
          isLoading: query.isPending,
          error: query.error,
          onRetry: () => void query.refetch(),
        }}
        empty={
          <EmptyState
            title="Chưa có hồ sơ nào"
            description="Hồ sơ ứng viên nộp qua cổng tuyển dụng sẽ hiện ở đây."
          />
        }
      />
      {meta && meta.total > 0 && (
        <div className="flex justify-end border-t border-hf-border p-4">
          <ListPagination meta={meta} onPageChange={setPage} />
        </div>
      )}
    </SectionCard>
  );
}

type Dialog = 'publish' | 'stop' | 'delete';

export function JobDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [open, setOpen] = React.useState(false);
  const query = useQuery({
    queryKey: queryKeys.detail('job', id),
    queryFn: ({ signal }) => fetchJob(id, signal),
  });

  if (query.isPending) return <Skeleton className="h-64 w-full max-w-3xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const job: Job = query.data;

  function ask(next: Dialog) {
    setDialog(next);
    setOpen(true);
  }
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.entity('job') });
  }

  const buttons: Record<JobAction, React.ReactNode> = {
    edit: (
      <Link
        href={`/jobs/${id}/edit`}
        className={buttonVariants({ variant: 'secondary' })}
      >
        Sửa
      </Link>
    ),
    publish: (
      <Button variant="primary" onClick={() => ask('publish')}>
        Đăng tin
      </Button>
    ),
    stop: <Button onClick={() => ask('stop')}>Ngừng đăng</Button>,
    delete: <Button onClick={() => ask('delete')}>Xóa</Button>,
  };

  return (
    <>
      <PageHeader
        title={job.title}
        description={
          job.requisition ? `Yêu cầu ${job.requisition.code}` : undefined
        }
        actions={jobActionsFor(job.status).map((action) => (
          <PermissionGate key={action} permission={PERMISSION[action]}>
            {buttons[action] as React.ReactElement<{ disabled?: boolean }>}
          </PermissionGate>
        ))}
      />
      <Tabs defaultValue="info" className="max-w-4xl">
        <TabsList aria-label="Nội dung tin">
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="applications">
            Hồ sơ đã nộp ({job.applicationCount})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="flex flex-col gap-6">
          <SectionCard
            title="Thông tin"
            actions={<StatusBadge status={job.status} map={JOB_STATUS_MAP} />}
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Phòng ban">
                {job.department?.name}
              </DetailField>
              <DetailField label="Vị trí">{job.position?.name}</DetailField>
              <DetailField label="Số lượng">{job.quantity}</DetailField>
              <DetailField label="Địa điểm">{job.location}</DetailField>
              <DetailField label="Mức lương">
                {salaryText(job.salaryMin, job.salaryMax)}
              </DetailField>
              <DetailField label="Ngày đăng">
                {job.publishedAt ? formatDate(job.publishedAt) : null}
              </DetailField>
              <DetailField label="Người tạo">{job.createdBy?.name}</DetailField>
            </dl>
          </SectionCard>
          <SectionCard title="Mô tả công việc">
            <JobDescription html={job.description} />
          </SectionCard>
        </TabsContent>
        <TabsContent value="applications">
          <JobApplications jobId={id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={open && dialog === 'publish'}
        onOpenChange={setOpen}
        title="Đăng tin"
        description="Tin sẽ hiển thị trên cổng tuyển dụng và nhận hồ sơ từ ứng viên."
        confirmLabel="Đăng tin"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await publishJob(id);
          await refresh();
          toast.success('Đã đăng tin');
        }}
      />
      <ConfirmDialog
        open={open && dialog === 'stop'}
        onOpenChange={setOpen}
        title="Ngừng đăng tin"
        description="Cổng công khai sẽ trả trang “không còn nhận hồ sơ” cho tin này. Tin đã đóng không mở lại được."
        confirmLabel="Ngừng đăng"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await stopJob(id);
          await refresh();
          toast.success('Đã ngừng đăng tin');
        }}
      />
      <ConfirmDialog
        open={open && dialog === 'delete'}
        onOpenChange={setOpen}
        title="Xóa tin"
        description="Chỉ xóa được tin ở trạng thái Nháp và thao tác này không thể hoàn tác."
        confirmLabel="Xóa tin"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await deleteJob(id);
          toast.success('Đã xóa tin');
          router.replace('/jobs');
          await queryClient.invalidateQueries({
            queryKey: [...queryKeys.entity('job'), 'list'],
          });
        }}
      />
    </>
  );
}
