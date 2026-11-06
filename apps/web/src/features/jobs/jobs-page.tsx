'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@hiflow/shared-types';
import { z } from 'zod';

import { ErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type DataColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterSelect } from '@/components/shared/filter-select';
import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { ListPagination } from '@/components/shared/list-pagination';
import { PageSizeSelector } from '@/components/shared/page-size-selector';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useDepartmentOptions,
  usePositionOptions,
} from '@/features/catalogs/options';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  JOB_SORT_KEYS,
  JOB_STATUS_MAP,
  JOB_STATUS_OPTIONS,
  isJobStatus,
} from './constants';
import { fetchJobs, type Job } from './job-api';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

// A module constant: `useListParams` needs a stable schema object.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(JOB_SORT_KEYS).catch('createdAt'),
  sortDir: z.enum(['asc', 'desc']).catch('desc'),
  status: z.string().refine(isJobStatus).optional().catch(undefined),
  departmentId: z.string().uuid().optional().catch(undefined),
  positionId: z.string().uuid().optional().catch(undefined),
  requisitionId: z.string().uuid().optional().catch(undefined),
  createdFrom: dateParam,
  createdTo: dateParam,
};

export function JobsPage() {
  const { can } = useSession();
  const departments = useDepartmentOptions();
  const positions = usePositionOptions();
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(LIST_SHAPE);
  const { page, limit, search, sortBy, sortDir, createdFrom, createdTo } =
    params;
  const request = {
    page,
    limit,
    search,
    sortBy,
    sortDir,
    status: params.status as Job['status'] | undefined,
    departmentId: params.departmentId,
    positionId: params.positionId,
    requisitionId: params.requisitionId,
    createdFrom,
    createdTo,
  };
  const query = useQuery({
    queryKey: queryKeys.list('job', request),
    queryFn: ({ signal }) => fetchJobs(request, signal),
    placeholderData: keepPreviousData,
    enabled: can(PERMISSIONS.job.listView),
  });

  if (!can(PERMISSIONS.job.listView)) {
    return <ErrorView kind="forbidden" />;
  }

  const columns: DataColumn<Job>[] = [
    {
      id: 'title',
      header: 'Tiêu đề',
      sortKey: 'title',
      cell: (job) => <span className="font-medium">{job.title}</span>,
    },
    {
      id: 'requisition',
      header: 'Yêu cầu',
      cell: (job) => job.requisition?.code ?? '—',
    },
    {
      id: 'department',
      header: 'Phòng ban',
      cell: (job) => job.department?.name ?? '—',
    },
    {
      id: 'quantity',
      header: 'Số lượng',
      sortKey: 'quantity',
      align: 'right',
      cell: (job) => job.quantity,
    },
    {
      id: 'applications',
      header: 'Hồ sơ',
      align: 'right',
      cell: (job) => job.applicationCount,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      sortKey: 'status',
      cell: (job) => <StatusBadge status={job.status} map={JOB_STATUS_MAP} />,
    },
    {
      id: 'publishedAt',
      header: 'Ngày đăng',
      sortKey: 'publishedAt',
      cell: (job) => (job.publishedAt ? formatDate(job.publishedAt) : '—'),
    },
  ];
  const meta = query.data?.meta;
  const createLink = can(PERMISSIONS.job.create) ? (
    <Link href="/jobs/new" className={buttonVariants({ variant: 'primary' })}>
      Tạo tin
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Tin tuyển dụng"
        description="Các tin hiển thị cho ứng viên trên cổng tuyển dụng."
        actions={createLink}
      />
      <SectionCard flush>
        <div className="border-b border-hf-border p-4">
          <FilterToolbar
            search={search}
            onSearchChange={(next) => setParams({ search: next })}
            searchLabel="Tìm tin"
            searchPlaceholder="Tìm theo tiêu đề"
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
            advanced={{
              title: 'Lọc theo ngày tạo',
              children: (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Từ ngày
                    <Input
                      type="date"
                      value={createdFrom ?? ''}
                      max={createdTo}
                      onChange={(e) =>
                        setParams({ createdFrom: e.target.value || undefined })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Đến ngày
                    <Input
                      type="date"
                      value={createdTo ?? ''}
                      min={createdFrom}
                      onChange={(e) =>
                        setParams({ createdTo: e.target.value || undefined })
                      }
                    />
                  </label>
                </div>
              ),
            }}
          >
            <FilterSelect
              label="Lọc theo trạng thái"
              value={params.status}
              allLabel="Mọi trạng thái"
              options={JOB_STATUS_OPTIONS}
              onChange={(next) => setParams({ status: next })}
            />
            <FilterSelect
              label="Lọc theo phòng ban"
              value={params.departmentId}
              allLabel="Mọi phòng ban"
              options={departments.options}
              onChange={(next) => setParams({ departmentId: next })}
            />
            <FilterSelect
              label="Lọc theo vị trí"
              value={params.positionId}
              allLabel="Mọi vị trí"
              options={positions.options}
              onChange={(next) => setParams({ positionId: next })}
            />
          </FilterToolbar>
        </div>
        <DataTable
          caption="Danh sách tin tuyển dụng"
          columns={columns}
          rows={query.data?.items ?? []}
          getRowKey={(job) => job.id}
          getRowHref={(job) => `/jobs/${job.id}`}
          sort={{
            sortBy,
            sortDir,
            onChange: (nextBy, nextDir) =>
              setParams({ sortBy: nextBy, sortDir: nextDir }),
          }}
          state={{
            isLoading: query.isPending,
            error: query.error,
            onRetry: () => void query.refetch(),
          }}
          empty={
            page > 1 ? (
              <EmptyState
                title="Trang này không còn dữ liệu"
                action={
                  <Button onClick={() => setParams({ page: 1 })}>
                    Về trang đầu
                  </Button>
                }
              />
            ) : hasActiveFilters ? (
              <EmptyState
                title="Không có kết quả"
                description="Không có tin nào khớp với bộ lọc hiện tại."
                action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <EmptyState
                title="Chưa có tin tuyển dụng nào"
                description="Tạo tin từ một yêu cầu đã được duyệt."
                action={createLink}
              />
            )
          }
        />
        {meta && meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hf-border p-4">
            <PageSizeSelector
              value={limit}
              onChange={(next) => setParams({ limit: next })}
            />
            <ListPagination
              meta={meta}
              onPageChange={(next) =>
                setParams({ page: next }, { keepPage: true })
              }
            />
          </div>
        )}
      </SectionCard>
    </>
  );
}
