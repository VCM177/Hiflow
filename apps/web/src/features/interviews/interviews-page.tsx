'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PERMISSIONS, USER_OPTION_PURPOSE } from '@hiflow/shared-types';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { INTERVIEW_RESULT_MAP } from '@/features/applications/constants';
import { useUserOptions } from '@/features/users/options';
import { useListParams } from '@/hooks/use-list-params';
import { formatDateTime } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  INTERVIEW_RESULT_OPTIONS,
  INTERVIEW_SORT_KEYS,
  MAX_ROUND,
  isInterviewResult,
} from './constants';
import { fetchInterviews, type Interview } from './interview-api';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

// A module constant: `useListParams` needs a stable schema object. The default order is the
// soonest interview first.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(INTERVIEW_SORT_KEYS).catch('scheduledAt'),
  sortDir: z.enum(['asc', 'desc']).catch('asc'),
  result: z.string().refine(isInterviewResult).optional().catch(undefined),
  interviewerId: z.string().uuid().optional().catch(undefined),
  applicationId: z.string().uuid().optional().catch(undefined),
  round: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ROUND)
    .optional()
    .catch(undefined),
  scheduledFrom: dateParam,
  scheduledTo: dateParam,
};

const ROUND_OPTIONS = Array.from({ length: MAX_ROUND }, (_, index) => ({
  value: String(index + 1),
  label: `Vòng ${index + 1}`,
}));

export function InterviewsPage() {
  const { can } = useSession();
  const interviewers = useUserOptions(USER_OPTION_PURPOSE.INTERVIEWER);
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(LIST_SHAPE);
  const { page, limit, search, sortBy, sortDir, scheduledFrom, scheduledTo } =
    params;
  const request = {
    page,
    limit,
    search,
    sortBy,
    sortDir,
    result: params.result as Interview['result'] | undefined,
    interviewerId: params.interviewerId,
    applicationId: params.applicationId,
    round: params.round,
    scheduledFrom,
    scheduledTo,
  };
  const query = useQuery({
    queryKey: queryKeys.list('interview', request),
    queryFn: ({ signal }) => fetchInterviews(request, signal),
    placeholderData: keepPreviousData,
    enabled: can(PERMISSIONS.interview.listView),
  });

  if (!can(PERMISSIONS.interview.listView)) {
    return <ErrorView kind="forbidden" />;
  }

  const columns: DataColumn<Interview>[] = [
    {
      id: 'candidate',
      header: 'Ứng viên',
      cell: (item) => (
        <span className="font-medium">
          {item.application?.candidate?.fullName ?? '—'}
        </span>
      ),
    },
    {
      id: 'job',
      header: 'Tin tuyển dụng',
      cell: (item) => item.application?.job?.title ?? '—',
    },
    {
      id: 'round',
      header: 'Vòng',
      sortKey: 'round',
      align: 'right',
      cell: (item) => item.round,
    },
    {
      id: 'scheduledAt',
      header: 'Giờ phỏng vấn',
      sortKey: 'scheduledAt',
      cell: (item) => formatDateTime(item.scheduledAt),
    },
    {
      id: 'interviewer',
      header: 'Người phỏng vấn',
      cell: (item) => item.interviewer?.name ?? '—',
    },
    {
      id: 'result',
      header: 'Kết quả',
      sortKey: 'result',
      cell: (item) => (
        <StatusBadge status={item.result} map={INTERVIEW_RESULT_MAP} />
      ),
    },
  ];
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        title="Lịch phỏng vấn"
        description="Các buổi phỏng vấn và kết quả."
      />
      <SectionCard flush>
        <div className="border-b border-hf-border p-4">
          <FilterToolbar
            search={search}
            onSearchChange={(next) => setParams({ search: next })}
            searchLabel="Tìm lịch phỏng vấn"
            searchPlaceholder="Tìm theo tên ứng viên hoặc tin"
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
            advanced={{
              title: 'Lọc theo ngày phỏng vấn',
              children: (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Từ ngày
                    <Input
                      type="date"
                      value={scheduledFrom ?? ''}
                      max={scheduledTo}
                      onChange={(e) =>
                        setParams({
                          scheduledFrom: e.target.value || undefined,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-hf-text-heading">
                    Đến ngày
                    <Input
                      type="date"
                      value={scheduledTo ?? ''}
                      min={scheduledFrom}
                      onChange={(e) =>
                        setParams({ scheduledTo: e.target.value || undefined })
                      }
                    />
                  </label>
                </div>
              ),
            }}
          >
            <FilterSelect
              label="Lọc theo kết quả"
              value={params.result}
              allLabel="Mọi kết quả"
              options={INTERVIEW_RESULT_OPTIONS}
              onChange={(next) => setParams({ result: next })}
            />
            <FilterSelect
              label="Lọc theo vòng"
              value={
                params.round === undefined ? undefined : String(params.round)
              }
              allLabel="Mọi vòng"
              options={ROUND_OPTIONS}
              onChange={(next) =>
                setParams({
                  round: next === undefined ? undefined : Number(next),
                })
              }
            />
            <FilterSelect
              label="Lọc theo người phỏng vấn"
              value={params.interviewerId}
              allLabel="Mọi người phỏng vấn"
              options={interviewers.options}
              onChange={(next) => setParams({ interviewerId: next })}
            />
          </FilterToolbar>
        </div>
        <DataTable
          caption="Danh sách lịch phỏng vấn"
          columns={columns}
          rows={query.data?.items ?? []}
          getRowKey={(item) => item.id}
          getRowHref={(item) => `/interviews/${item.id}`}
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
                description="Không có lịch phỏng vấn nào khớp với bộ lọc hiện tại."
                action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <EmptyState
                title="Chưa có lịch phỏng vấn nào"
                description="Lịch được đặt từ trang chi tiết của hồ sơ ứng tuyển ở bậc Phỏng vấn."
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
