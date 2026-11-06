'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PERMISSIONS, type ReportType } from '@hiflow/shared-types';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { ApiErrorView, ErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type DataColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterSelect } from '@/components/shared/filter-select';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useDepartmentOptions,
  usePositionOptions,
} from '@/features/catalogs/options';
import { useListParams } from '@/hooks/use-list-params';
import { ApiError } from '@/lib/api/errors';
import { describeApiError } from '@/lib/api/describe-error';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { REPORT_TAB_LABEL, REPORT_TYPES, isReportType } from './constants';
import { exportReport, fetchReport, type ReportData } from './report-api';

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const idParam = z.string().uuid().optional().catch(undefined);

// A module constant: `useListParams` needs a stable schema object.
const SHAPE = {
  from: dateParam,
  to: dateParam,
  departmentId: idParam,
  positionId: idParam,
};

type Row = ReportData['rows'][number];

/** A report row has no id of its own: the whole line is its identity. */
const rowKey = (row: Row) => JSON.stringify(row);

/**
 * One report as a table, exactly as the API describes it (`columns` then `rows`). Numbers are
 * right-aligned. The type is part of the address, so a tab can be shared; the period and the
 * filters are in the query string.
 */
export function ReportsPage({ type }: { type: ReportType }) {
  const { can } = useSession();
  const router = useRouter();
  const departments = useDepartmentOptions();
  const positions = usePositionOptions();
  const [exporting, setExporting] = React.useState(false);
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(SHAPE);
  const request = {
    from: params.from,
    to: params.to,
    departmentId: params.departmentId,
    positionId: params.positionId,
  };
  const allowed = can(PERMISSIONS.report.overviewView);
  const query = useQuery({
    queryKey: queryKeys.list('report', { type, ...request }),
    queryFn: ({ signal }) => fetchReport(type, request, signal),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });

  if (!allowed) return <ErrorView kind="forbidden" />;

  async function exportCsv() {
    setExporting(true);
    try {
      const name = await exportReport(type, request);
      toast.success(`Đã tải ${name}`);
    } catch (error) {
      toast.error(describeApiError(error).message);
    } finally {
      setExporting(false);
    }
  }

  const data = query.data;
  const periodError =
    query.error instanceof ApiError && query.error.status === 400
      ? query.error.messages[0]
      : null;
  const columns: DataColumn<Row>[] = (data?.columns ?? []).map(
    (column, index) => ({
      id: column.key,
      header: column.label,
      // The first column names the line; the rest are figures.
      align: index === 0 ? 'left' : 'right',
      cell: (row) => row[column.key] ?? '—',
    }),
  );

  return (
    <>
      <PageHeader
        title="Báo cáo"
        description={
          data
            ? `Kỳ ${formatDate(data.period.from)} – ${formatDate(data.period.to)}`
            : 'Số liệu tuyển dụng theo kỳ.'
        }
        actions={
          <PermissionGate permission={PERMISSIONS.report.overviewExport}>
            <Button
              onClick={() => void exportCsv()}
              disabled={exporting || !data}
            >
              {exporting ? <Spinner /> : <Download aria-hidden="true" />}
              Xuất CSV
            </Button>
          </PermissionGate>
        }
      />
      <Tabs
        value={type}
        onValueChange={(next) => {
          if (isReportType(next)) {
            // The period and filters stay when the tab changes.
            const search = new URLSearchParams(
              window.location.search,
            ).toString();
            router.push(`/reports/${next}${search ? `?${search}` : ''}`);
          }
        }}
      >
        <TabsList aria-label="Loại báo cáo">
          {REPORT_TYPES.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {REPORT_TAB_LABEL[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div
        className="my-4 flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Lọc báo cáo"
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
        {hasActiveFilters && (
          <Button variant="ghost" onClick={resetFilters}>
            Xóa bộ lọc
          </Button>
        )}
      </div>
      {periodError && (
        <p role="alert" className="mb-4 text-sm text-hf-destructive-text">
          {periodError}
        </p>
      )}

      {query.error && !data && !periodError ? (
        <ApiErrorView
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <SectionCard flush>
          <DataTable
            caption={data?.title ?? REPORT_TAB_LABEL[type]}
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={rowKey}
            state={{
              isLoading: query.isPending,
              error: periodError ? undefined : query.error,
              onRetry: () => void query.refetch(),
            }}
            empty={
              <EmptyState
                title="Không có số liệu"
                description="Không có dữ liệu trong kỳ và bộ lọc này."
              />
            }
          />
        </SectionCard>
      )}
      <p className="mt-3 text-xs text-hf-text-muted">
        Mỗi lần xuất CSV được ghi vào nhật ký kiểm toán.
      </p>
    </>
  );
}
