'use client';

import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  PERMISSIONS,
  USER_ROLE_LABEL,
  type UserRole,
} from '@hiflow/shared-types';
import { Download } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { fetchUsers } from '@/features/users/user-api';
import { useListParams } from '@/hooks/use-list-params';
import { describeApiError } from '@/lib/api/describe-error';
import { formatDateTime } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  exportAuditEvents,
  fetchAuditEvents,
  type AuditEventRow,
  type AuditListQuery,
} from './audit-api';
import {
  AUDIT_EVENT_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  EXPORT_ROW_LIMIT,
  ORIGIN_LABEL,
  ORIGIN_OPTIONS,
  isAuditEvent,
  isAuditOrigin,
} from './constants';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

// A module constant: `useListParams` needs a stable schema object. Newest first by default.
const LIST_SHAPE = {
  ...listBaseShape,
  sortDir: z.enum(['asc', 'desc']).catch('desc'),
  event: z.string().refine(isAuditEvent).optional().catch(undefined),
  entityType: z.string().max(32).optional().catch(undefined),
  entityId: z.string().uuid().optional().catch(undefined),
  actorId: z.string().uuid().optional().catch(undefined),
  origin: z.string().refine(isAuditOrigin).optional().catch(undefined),
  from: dateParam,
  to: dateParam,
};

/** The people the actor filter offers: the first hundred, by name. */
function useActorOptions() {
  const { can } = useSession();
  const query = useQuery({
    queryKey: queryKeys.options('user', { for: 'audit' }),
    queryFn: ({ signal }) =>
      fetchUsers(
        {
          page: 1,
          limit: 100,
          search: '',
          sortBy: 'fullName',
          sortDir: 'asc',
          role: undefined,
          departmentId: undefined,
          isActive: undefined,
        },
        signal,
      ),
    enabled: can(PERMISSIONS.user.listView),
    staleTime: 5 * 60 * 1000,
  });
  return (query.data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.fullName,
  }));
}

export function AuditPage() {
  const { can } = useSession();
  const actors = useActorOptions();
  const [exporting, setExporting] = React.useState(false);
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(LIST_SHAPE);
  const { page, limit, search, sortDir } = params;
  const filter = {
    event: params.event,
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    origin: params.origin,
    from: params.from,
    to: params.to,
  };
  const request: AuditListQuery = { ...filter, page, limit, search, sortDir };
  const allowed = can(PERMISSIONS.audit.eventView);
  const query = useQuery({
    queryKey: queryKeys.list('audit-event', request),
    queryFn: ({ signal }) => fetchAuditEvents(request, signal),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });

  if (!allowed) return <ErrorView kind="forbidden" />;

  async function exportCsv() {
    setExporting(true);
    try {
      const name = await exportAuditEvents(filter);
      toast.success(`Đã tải ${name}`);
    } catch (error) {
      toast.error(describeApiError(error).message);
    } finally {
      setExporting(false);
    }
  }

  const columns: DataColumn<AuditEventRow>[] = [
    {
      id: 'occurredAt',
      header: 'Thời gian',
      sortKey: 'occurredAt',
      cell: (item) => formatDateTime(item.occurredAt),
    },
    {
      id: 'event',
      header: 'Sự kiện',
      cell: (item) => <span className="font-medium">{item.label}</span>,
    },
    {
      id: 'actor',
      header: 'Người thực hiện',
      cell: (item) => (
        <span>
          {item.actor.name ?? 'Khách'}
          {item.actor.role && (
            <span className="text-hf-text-muted">
              {' · '}
              {USER_ROLE_LABEL[item.actor.role as UserRole] ?? item.actor.role}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'entity',
      header: 'Đối tượng',
      cell: (item) => item.entityType,
    },
    {
      id: 'origin',
      header: 'Nguồn',
      cell: (item) =>
        ORIGIN_LABEL[item.origin as keyof typeof ORIGIN_LABEL] ?? item.origin,
    },
  ];
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        title="Nhật ký kiểm toán"
        description="Ai đã làm gì, lúc nào. Nhật ký chứa dữ liệu cá nhân, chỉ Admin được đọc."
        actions={
          <PermissionGate permission={PERMISSIONS.audit.eventExport}>
            <Button onClick={() => void exportCsv()} disabled={exporting}>
              {exporting ? <Spinner /> : <Download aria-hidden="true" />}
              Xuất CSV
            </Button>
          </PermissionGate>
        }
      />
      <SectionCard flush>
        <div className="border-b border-hf-border p-4">
          <FilterToolbar
            search={search}
            onSearchChange={(next) => setParams({ search: next })}
            searchLabel="Tìm theo người thực hiện"
            searchPlaceholder="Tên người thực hiện"
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
            advanced={{
              title: 'Lọc theo thời gian',
              children: (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Từ ngày
                    <Input
                      type="date"
                      value={params.from ?? ''}
                      max={params.to}
                      onChange={(e) =>
                        setParams({ from: e.target.value || undefined })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Đến ngày
                    <Input
                      type="date"
                      value={params.to ?? ''}
                      min={params.from}
                      onChange={(e) =>
                        setParams({ to: e.target.value || undefined })
                      }
                    />
                  </label>
                </div>
              ),
            }}
          >
            <FilterSelect
              label="Lọc theo sự kiện"
              value={params.event}
              allLabel="Mọi sự kiện"
              options={AUDIT_EVENT_OPTIONS}
              onChange={(next) => setParams({ event: next })}
            />
            <FilterSelect
              label="Lọc theo đối tượng"
              value={params.entityType}
              allLabel="Mọi đối tượng"
              options={ENTITY_TYPE_OPTIONS}
              onChange={(next) => setParams({ entityType: next })}
            />
            <FilterSelect
              label="Lọc theo người thực hiện"
              value={params.actorId}
              allLabel="Mọi người"
              options={actors}
              onChange={(next) => setParams({ actorId: next })}
            />
            <FilterSelect
              label="Lọc theo nguồn"
              value={params.origin}
              allLabel="Mọi nguồn"
              options={ORIGIN_OPTIONS}
              onChange={(next) => setParams({ origin: next })}
            />
          </FilterToolbar>
        </div>
        <DataTable
          caption="Danh sách sự kiện nhật ký"
          columns={columns}
          rows={query.data?.items ?? []}
          getRowKey={(item) => item.id}
          getRowHref={(item) => `/audit-events/${item.id}`}
          sort={{
            sortBy: 'occurredAt',
            sortDir,
            onChange: (_by, nextDir) => setParams({ sortDir: nextDir }),
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
                title="Không có sự kiện nào"
                description="Không có sự kiện nào khớp với bộ lọc hiện tại."
                action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <EmptyState title="Chưa có sự kiện nào" />
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
      <p className="mt-3 text-xs text-hf-text-muted">
        Tệp CSV lấy theo bộ lọc hiện tại, tối đa{' '}
        {new Intl.NumberFormat('vi-VN').format(EXPORT_ROW_LIMIT)} dòng mới nhất.
        Mỗi lần xuất cũng được ghi vào nhật ký.
      </p>
    </>
  );
}
