'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { z } from 'zod';

import { ApiErrorView, ErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { FilterSelect } from '@/components/shared/filter-select';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDepartmentOptions } from '@/features/catalogs/options';
import { useListParams } from '@/hooks/use-list-params';
import { ApiError } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { fetchOverview, type Overview } from './dashboard-api';
import { FunnelChart } from './funnel-chart';
import { TodoList } from './todo-list';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

// A module constant: `useListParams` needs a stable schema object.
const SHAPE = {
  from: dateParam,
  to: dateParam,
  departmentId: z.string().uuid().optional().catch(undefined),
};

const NUMBER = new Intl.NumberFormat('vi-VN');

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-hf-container border border-hf-border bg-hf-bg-card p-4 shadow-hf-card">
      <p className="text-xs text-hf-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-hf-text-heading tabular-nums">
        {NUMBER.format(value)}
      </p>
    </div>
  );
}

function Cards({ cards }: { cards: Overview['cards'] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatTile label="Yêu cầu chờ duyệt" value={cards.pendingRequisitions} />
      <StatTile label="Tin đang tuyển" value={cards.openJobs} />
      <StatTile label="Hồ sơ mới" value={cards.newApplications} />
      <StatTile label="Phỏng vấn sắp tới" value={cards.upcomingInterviews} />
      <StatTile label="Đã nhận việc trong kỳ" value={cards.hiredInPeriod} />
    </div>
  );
}

export function DashboardPage() {
  const { user, can } = useSession();
  const departments = useDepartmentOptions();
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(SHAPE);
  const request = {
    from: params.from,
    to: params.to,
    departmentId: params.departmentId,
  };
  const query = useQuery({
    queryKey: queryKeys.list('dashboard', request),
    queryFn: ({ signal }) => fetchOverview(request, signal),
    placeholderData: keepPreviousData,
    enabled: can(PERMISSIONS.dashboard.overviewView),
  });

  if (!can(PERMISSIONS.dashboard.overviewView)) {
    return <ErrorView kind="forbidden" />;
  }

  const data = query.data;
  // A department manager is always confined to their own department.
  const choosesDepartment = user.role !== UserRole.DEPT_MANAGER;
  // A bad period (more than a year, start after end) is the person's to fix, not a page error.
  const periodError =
    query.error instanceof ApiError && query.error.status === 400
      ? query.error.messages[0]
      : null;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        description={
          data
            ? `Kỳ ${formatDate(data.period.from)} – ${formatDate(data.period.to)}`
            : undefined
        }
      />
      <div
        className="mb-6 flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Chọn kỳ"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
          Từ ngày
          <Input
            type="date"
            value={params.from ?? ''}
            max={params.to}
            onChange={(e) => setParams({ from: e.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
          Đến ngày
          <Input
            type="date"
            value={params.to ?? ''}
            min={params.from}
            onChange={(e) => setParams({ to: e.target.value || undefined })}
          />
        </label>
        {choosesDepartment && (
          <FilterSelect
            label="Lọc theo phòng ban"
            value={params.departmentId}
            allLabel="Mọi phòng ban"
            options={departments.options}
            onChange={(next) => setParams({ departmentId: next })}
          />
        )}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={resetFilters}>
            Về 30 ngày gần nhất
          </Button>
        )}
      </div>
      {periodError && (
        <p role="alert" className="mb-4 text-sm text-hf-destructive-text">
          {periodError}
        </p>
      )}

      {query.isPending ? (
        <div className="flex flex-col gap-6" role="status">
          <span className="sr-only">Đang tải số liệu</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !data ? (
        <ApiErrorView
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Cards cards={data.cards} />
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionCard
                title="Phễu tuyển dụng"
                description="Số hồ sơ đã từng đạt mỗi bậc trong kỳ."
              >
                <FunnelChart funnel={data.funnel} />
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hf-border pt-4">
                  <div>
                    <dt className="text-xs text-hf-text-muted">Bị từ chối</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-hf-text-heading tabular-nums">
                      {NUMBER.format(data.outcomes.rejected)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-hf-text-muted">Ứng viên rút</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-hf-text-heading tabular-nums">
                      {NUMBER.format(data.outcomes.withdrawn)}
                    </dd>
                  </div>
                </dl>
              </SectionCard>
            </div>
            <SectionCard title="Việc cần xử lý">
              <TodoList todo={data.todo} />
            </SectionCard>
          </div>
        </div>
      )}
    </>
  );
}
