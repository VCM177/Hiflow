'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { PERMISSIONS } from '@hiflow/shared-types';
import { toast } from 'sonner';
import { z } from 'zod';

import { ErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type DataColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterSelect } from '@/components/shared/filter-select';
import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { ListPagination } from '@/components/shared/list-pagination';
import { PageSizeSelector } from '@/components/shared/page-size-selector';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDepartmentOptions } from '@/features/catalogs/options';
import { useUserOptions } from '@/features/users/options';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  ApplicationCreateDialog,
  toCreateBody,
  type CreateApplicationValues,
} from './application-create-dialog';
import {
  createApplication,
  fetchApplications,
  type ApplicationItem,
} from './application-api';
import {
  APPLICATION_SORT_KEYS,
  APPLICATION_STATUS_MAP,
  APPLICATION_STATUS_OPTIONS,
  isApplicationStatus,
} from './constants';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const idParam = z.string().uuid().optional().catch(undefined);

// A module constant: `useListParams` needs a stable schema object.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(APPLICATION_SORT_KEYS).catch('appliedAt'),
  sortDir: z.enum(['asc', 'desc']).catch('desc'),
  status: z.string().refine(isApplicationStatus).optional().catch(undefined),
  jobId: idParam,
  candidateId: idParam,
  assigneeId: idParam,
  departmentId: idParam,
  appliedFrom: dateParam,
  appliedTo: dateParam,
};

export function ApplicationsPage() {
  const { can } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const departments = useDepartmentOptions();
  const assignees = useUserOptions('ASSIGNEE');
  const [dialogKey, setDialogKey] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(LIST_SHAPE);
  const { page, limit, search, sortBy, sortDir, appliedFrom, appliedTo } =
    params;
  const request = {
    page,
    limit,
    search,
    sortBy,
    sortDir,
    status: params.status as ApplicationItem['status'] | undefined,
    jobId: params.jobId,
    candidateId: params.candidateId,
    assigneeId: params.assigneeId,
    departmentId: params.departmentId,
    appliedFrom,
    appliedTo,
  };
  const query = useQuery({
    queryKey: queryKeys.list('application', request),
    queryFn: ({ signal }) => fetchApplications(request, signal),
    placeholderData: keepPreviousData,
    enabled: can(PERMISSIONS.application.listView),
  });

  if (!can(PERMISSIONS.application.listView)) {
    return <ErrorView kind="forbidden" />;
  }

  function openCreate() {
    setDialogKey((key) => (key ?? 0) + 1);
    setOpen(true);
  }

  async function create(values: CreateApplicationValues) {
    const created = await createApplication(toCreateBody(values));
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('application'),
    });
    toast.success('Đã thêm hồ sơ ứng tuyển');
    router.push(`/applications/${created.id}`);
  }

  // A manager has no candidate page, so the name in their list is plain text.
  const columns: DataColumn<ApplicationItem>[] = [
    {
      id: 'candidate',
      header: 'Ứng viên',
      sortKey: 'candidateName',
      cell: (item) => (
        <span className="font-medium">{item.candidate?.fullName ?? '—'}</span>
      ),
    },
    {
      id: 'job',
      header: 'Tin tuyển dụng',
      sortKey: 'jobTitle',
      cell: (item) => item.job?.title ?? '—',
    },
    {
      id: 'status',
      header: 'Trạng thái',
      sortKey: 'status',
      cell: (item) => (
        <StatusBadge status={item.status} map={APPLICATION_STATUS_MAP} />
      ),
    },
    {
      id: 'appliedAt',
      header: 'Ngày nộp',
      sortKey: 'appliedAt',
      cell: (item) => formatDate(item.appliedAt),
    },
    {
      id: 'assignee',
      header: 'Phụ trách',
      cell: (item) => item.assignee?.name ?? 'Chưa phân công',
    },
  ];
  const meta = query.data?.meta;
  const addButton = (
    <PermissionGate permission={PERMISSIONS.application.create}>
      <Button variant="primary" onClick={openCreate}>
        Thêm hồ sơ
      </Button>
    </PermissionGate>
  );

  return (
    <>
      <PageHeader
        title="Hồ sơ ứng tuyển"
        description="Ứng viên đang đi qua quy trình tuyển dụng."
        actions={addButton}
      />
      <SectionCard flush>
        <div className="border-b border-hf-border p-4">
          <FilterToolbar
            search={search}
            onSearchChange={(next) => setParams({ search: next })}
            searchLabel="Tìm hồ sơ"
            searchPlaceholder="Tìm theo tên ứng viên hoặc tin"
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
            advanced={{
              title: 'Lọc theo ngày nộp',
              children: (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Từ ngày
                    <Input
                      type="date"
                      value={appliedFrom ?? ''}
                      max={appliedTo}
                      onChange={(e) =>
                        setParams({ appliedFrom: e.target.value || undefined })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Đến ngày
                    <Input
                      type="date"
                      value={appliedTo ?? ''}
                      min={appliedFrom}
                      onChange={(e) =>
                        setParams({ appliedTo: e.target.value || undefined })
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
              options={APPLICATION_STATUS_OPTIONS}
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
              label="Lọc theo người phụ trách"
              value={params.assigneeId}
              allLabel="Mọi người phụ trách"
              options={assignees.options}
              onChange={(next) => setParams({ assigneeId: next })}
            />
          </FilterToolbar>
        </div>
        <DataTable
          caption="Danh sách hồ sơ ứng tuyển"
          columns={columns}
          rows={query.data?.items ?? []}
          getRowKey={(item) => item.id}
          getRowHref={(item) => `/applications/${item.id}`}
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
                description="Không có hồ sơ nào khớp với bộ lọc hiện tại."
                action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <EmptyState
                title="Chưa có hồ sơ ứng tuyển nào"
                description="Hồ sơ nộp qua cổng tuyển dụng sẽ hiện ở đây, hoặc thêm thủ công."
                action={addButton}
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

      {dialogKey !== null && (
        <ApplicationCreateDialog
          key={dialogKey}
          open={open}
          onOpenChange={setOpen}
          onSubmit={create}
        />
      )}
    </>
  );
}
