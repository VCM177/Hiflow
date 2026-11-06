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
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDepartmentOptions } from '@/features/catalogs/options';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  REQUISITION_SORT_KEYS,
  REQUISITION_STATUS_MAP,
  REQUISITION_STATUS_OPTIONS,
  isRequisitionStatus,
} from './constants';
import { fetchRequisitions, type Requisition } from './requisition-api';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

// A module constant: `useListParams` needs a stable schema object.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(REQUISITION_SORT_KEYS).catch('createdAt'),
  sortDir: z.enum(['asc', 'desc']).catch('desc'),
  status: z.string().refine(isRequisitionStatus).optional().catch(undefined),
  departmentId: z.string().uuid().optional().catch(undefined),
  createdFrom: dateParam,
  createdTo: dateParam,
};

export function RequisitionsPage() {
  const { can } = useSession();
  const departments = useDepartmentOptions();
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
    status: params.status as Requisition['status'] | undefined,
    departmentId: params.departmentId,
    createdFrom,
    createdTo,
  };
  const query = useQuery({
    queryKey: queryKeys.list('requisition', request),
    queryFn: ({ signal }) => fetchRequisitions(request, signal),
    placeholderData: keepPreviousData,
    enabled: can(PERMISSIONS.requisition.listView),
  });

  if (!can(PERMISSIONS.requisition.listView)) {
    return <ErrorView kind="forbidden" />;
  }

  const columns: DataColumn<Requisition>[] = [
    {
      id: 'code',
      header: 'Mã',
      sortKey: 'code',
      cell: (item) => <span className="font-medium">{item.code}</span>,
    },
    { id: 'title', header: 'Tiêu đề', sortKey: 'title', cell: (i) => i.title },
    {
      id: 'department',
      header: 'Phòng ban',
      cell: (item) => item.department?.name ?? '—',
    },
    {
      id: 'position',
      header: 'Vị trí',
      cell: (item) => item.position?.name ?? '—',
    },
    {
      id: 'quantity',
      header: 'Số lượng',
      sortKey: 'quantity',
      align: 'right',
      cell: (item) => item.quantity,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      sortKey: 'status',
      cell: (item) => (
        <StatusBadge status={item.status} map={REQUISITION_STATUS_MAP} />
      ),
    },
    {
      id: 'createdAt',
      header: 'Ngày tạo',
      sortKey: 'createdAt',
      cell: (item) => formatDate(item.createdAt),
    },
  ];
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        title="Yêu cầu tuyển dụng"
        description="Nhu cầu nhân sự của các phòng ban, từ nháp đến khi được duyệt."
        actions={
          <PermissionGate permission={PERMISSIONS.requisition.create}>
            <Link
              href="/requisitions/new"
              className={buttonVariants({ variant: 'primary' })}
            >
              Tạo yêu cầu
            </Link>
          </PermissionGate>
        }
      />
      <SectionCard flush>
        <div className="border-b border-hf-border p-4">
          <FilterToolbar
            search={search}
            onSearchChange={(next) => setParams({ search: next })}
            searchLabel="Tìm yêu cầu"
            searchPlaceholder="Tìm theo mã hoặc tiêu đề"
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
              options={REQUISITION_STATUS_OPTIONS}
              onChange={(next) => setParams({ status: next })}
            />
            <FilterSelect
              label="Lọc theo phòng ban"
              value={params.departmentId}
              allLabel="Mọi phòng ban"
              options={departments.options}
              onChange={(next) => setParams({ departmentId: next })}
            />
          </FilterToolbar>
        </div>
        <DataTable
          caption="Danh sách yêu cầu tuyển dụng"
          columns={columns}
          rows={query.data?.items ?? []}
          getRowKey={(item) => item.id}
          getRowHref={(item) => `/requisitions/${item.id}`}
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
                description="Không có yêu cầu nào khớp với bộ lọc hiện tại."
                action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <EmptyState
                title="Chưa có yêu cầu tuyển dụng nào"
                description="Tạo yêu cầu đầu tiên để bắt đầu quy trình tuyển dụng."
                action={
                  <PermissionGate permission={PERMISSIONS.requisition.create}>
                    <Link
                      href="/requisitions/new"
                      className={buttonVariants({ variant: 'primary' })}
                    >
                      Tạo yêu cầu
                    </Link>
                  </PermissionGate>
                }
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
