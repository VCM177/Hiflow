'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';

import { DataTable, type DataColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { IconButton } from '@/components/shared/icon-button';
import { ListPagination } from '@/components/shared/list-pagination';
import { PageSizeSelector } from '@/components/shared/page-size-selector';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';

import { fetchCatalogList, type CatalogItem } from './catalog-api';
import { CATALOG_SORT_KEYS, type CatalogDefinition } from './constants';

// A module constant: `useListParams` needs a stable schema object.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(CATALOG_SORT_KEYS).catch('name'),
};

/**
 * One catalogue as a searchable, sortable, paged table. The list state lives in the URL;
 * creating, editing and deleting are opened by the page through the callbacks.
 */
export function CatalogTable({
  catalog,
  onCreate,
  onEdit,
  onDelete,
}: {
  catalog: CatalogDefinition;
  onCreate: () => void;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}) {
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(LIST_SHAPE);
  const { page, limit, search, sortBy, sortDir } = params;

  const query = useQuery({
    queryKey: queryKeys.list(catalog.kind, {
      page,
      limit,
      search,
      sortBy,
      sortDir,
    }),
    queryFn: ({ signal }) =>
      fetchCatalogList(
        catalog,
        { page, limit, search, sortBy, sortDir },
        signal,
      ),
    // Keep the rows on screen while the next page or sort loads.
    placeholderData: keepPreviousData,
  });

  const columns: DataColumn<CatalogItem>[] = [
    {
      id: 'name',
      header: 'Tên',
      sortKey: 'name',
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    { id: 'code', header: 'Mã', sortKey: 'code', cell: (item) => item.code },
    {
      id: 'createdAt',
      header: 'Ngày tạo',
      sortKey: 'createdAt',
      cell: (item) => formatDate(item.createdAt),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      interactive: true,
      cell: (item) => (
        <div className="flex gap-1">
          <PermissionGate permission={catalog.permissions.update}>
            <IconButton
              label={`Sửa ${item.name}`}
              icon={Pencil}
              onClick={() => onEdit(item)}
            />
          </PermissionGate>
          <PermissionGate permission={catalog.permissions.delete}>
            <IconButton
              label={`Xóa ${item.name}`}
              icon={Trash2}
              onClick={() => onDelete(item)}
            />
          </PermissionGate>
        </div>
      ),
    },
  ];

  const meta = query.data?.meta;

  return (
    <SectionCard flush>
      <div className="border-b border-hf-border p-4">
        <FilterToolbar
          search={search}
          onSearchChange={(next) => setParams({ search: next })}
          searchLabel={`Tìm ${catalog.singular}`}
          searchPlaceholder="Tìm theo tên hoặc mã"
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      </div>
      <DataTable
        caption={`Danh sách ${catalog.singular}`}
        columns={columns}
        rows={query.data?.items ?? []}
        getRowKey={(item) => item.id}
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
          <CatalogEmpty
            catalog={catalog}
            page={page}
            hasActiveFilters={hasActiveFilters}
            onCreate={onCreate}
            onReset={resetFilters}
            onFirstPage={() => setParams({ page: 1 })}
          />
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
  );
}

/** Why the table is empty, and the one thing to do about it. */
function CatalogEmpty({
  catalog,
  page,
  hasActiveFilters,
  onCreate,
  onReset,
  onFirstPage,
}: {
  catalog: CatalogDefinition;
  page: number;
  hasActiveFilters: boolean;
  onCreate: () => void;
  onReset: () => void;
  onFirstPage: () => void;
}) {
  if (page > 1) {
    return (
      <EmptyState
        title="Trang này không còn dữ liệu"
        description={`Có thể ${catalog.singular} ở trang này vừa bị xóa.`}
        action={<Button onClick={onFirstPage}>Về trang đầu</Button>}
      />
    );
  }
  if (hasActiveFilters) {
    return (
      <EmptyState
        title="Không có kết quả"
        description={`Không có ${catalog.singular} nào khớp với bộ lọc hiện tại.`}
        action={<Button onClick={onReset}>Xóa bộ lọc</Button>}
      />
    );
  }
  return (
    <EmptyState
      title={`Chưa có ${catalog.singular} nào`}
      description={`Thêm ${catalog.singular} đầu tiên để dùng trong các yêu cầu tuyển dụng.`}
      action={
        <PermissionGate permission={catalog.permissions.create}>
          <Button variant="primary" onClick={onCreate}>
            Thêm {catalog.singular}
          </Button>
        </PermissionGate>
      }
    />
  );
}
