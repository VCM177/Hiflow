'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { PERMISSIONS, SOURCE_LABEL } from '@hiflow/shared-types';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { CandidateFormDialog } from './candidate-form-dialog';
import {
  createCandidate,
  fetchCandidates,
  type Candidate,
} from './candidate-api';
import { toCandidateBody, type CandidateValues } from './candidate-schema';
import {
  ANONYMIZED_LABEL,
  CANDIDATE_PERMISSION,
  CANDIDATE_SORT_KEYS,
  SOURCE_OPTIONS,
  isCandidateSource,
} from './constants';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

// A module constant: `useListParams` needs a stable schema object.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(CANDIDATE_SORT_KEYS).catch('createdAt'),
  sortDir: z.enum(['asc', 'desc']).catch('desc'),
  source: z.string().refine(isCandidateSource).optional().catch(undefined),
  createdFrom: dateParam,
  createdTo: dateParam,
};

export function CandidatesPage() {
  const { can } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
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
    source: params.source as Candidate['source'] | undefined,
    createdFrom,
    createdTo,
  };
  const query = useQuery({
    queryKey: queryKeys.list('candidate', request),
    queryFn: ({ signal }) => fetchCandidates(request, signal),
    placeholderData: keepPreviousData,
    enabled: can(PERMISSIONS.candidate.listView),
  });

  if (!can(PERMISSIONS.candidate.listView)) {
    return <ErrorView kind="forbidden" />;
  }

  function openCreate() {
    setCreating((current) => (current ?? 0) + 1);
    setOpen(true);
  }

  async function create(values: CandidateValues) {
    const created = await createCandidate({
      ...toCandidateBody(values, 'create'),
      note: values.note === '' ? undefined : values.note,
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('candidate'),
    });
    toast.success(`Đã thêm ${created.fullName}`);
    router.push(`/candidates/${created.id}`);
  }

  const columns: DataColumn<Candidate>[] = [
    {
      id: 'fullName',
      header: 'Họ và tên',
      sortKey: 'fullName',
      cell: (item) => (
        <span className="flex items-center gap-2 font-medium">
          {item.fullName}
          {item.anonymizedAt && (
            <Badge variant="neutral">{ANONYMIZED_LABEL}</Badge>
          )}
        </span>
      ),
    },
    { id: 'email', header: 'Email', sortKey: 'email', cell: (i) => i.email },
    { id: 'phone', header: 'Điện thoại', cell: (i) => i.phone ?? '—' },
    {
      id: 'source',
      header: 'Nguồn',
      sortKey: 'source',
      cell: (item) => SOURCE_LABEL[item.source] ?? item.source,
    },
    { id: 'cv', header: 'CV', cell: (item) => (item.hasCv ? 'Có' : 'Chưa có') },
    {
      id: 'createdAt',
      header: 'Ngày tạo',
      sortKey: 'createdAt',
      cell: (item) => formatDate(item.createdAt),
    },
  ];
  const meta = query.data?.meta;
  const addButton = (
    <PermissionGate permission={CANDIDATE_PERMISSION.create}>
      <Button variant="primary" onClick={openCreate}>
        Thêm ứng viên
      </Button>
    </PermissionGate>
  );

  return (
    <>
      <PageHeader
        title="Ứng viên"
        description="Hồ sơ cá nhân của người ứng tuyển."
        actions={addButton}
      />
      <SectionCard flush>
        <div className="border-b border-hf-border p-4">
          <FilterToolbar
            search={search}
            onSearchChange={(next) => setParams({ search: next })}
            searchLabel="Tìm ứng viên"
            searchPlaceholder="Tìm theo tên hoặc email"
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
              label="Lọc theo nguồn"
              value={params.source}
              allLabel="Mọi nguồn"
              options={SOURCE_OPTIONS}
              onChange={(next) => setParams({ source: next })}
            />
          </FilterToolbar>
        </div>
        <DataTable
          caption="Danh sách ứng viên"
          columns={columns}
          rows={query.data?.items ?? []}
          getRowKey={(item) => item.id}
          getRowHref={(item) => `/candidates/${item.id}`}
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
                description="Không có ứng viên nào khớp với bộ lọc hiện tại."
                action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <EmptyState
                title="Chưa có ứng viên nào"
                description="Ứng viên nộp hồ sơ qua cổng tuyển dụng sẽ hiện ở đây, hoặc thêm thủ công."
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

      {creating !== null && (
        <CandidateFormDialog
          key={creating}
          candidate={null}
          open={open}
          onOpenChange={setOpen}
          onSubmit={create}
        />
      )}
    </>
  );
}
