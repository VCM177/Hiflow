'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/describe-error';
import { cn } from '@/lib/utils';

export interface DataColumn<TRow> {
  /** Stable key of the column. */
  id: string;
  header: string;
  cell: (row: TRow) => React.ReactNode;
  /** Numbers and money are right-aligned with tabular figures so digits line up. */
  align?: 'left' | 'right';
  /** The API's `sortBy` value. Without it the header is plain text. */
  sortKey?: string;
  /**
   * The cell holds its own buttons or links (row actions). It sits above the row's link so
   * its controls still receive clicks.
   */
  interactive?: boolean;
}

export type SortDirection = 'asc' | 'desc';

/** Sorting is controlled: the caller keeps it in the URL and passes it back. */
export interface DataTableSort {
  sortBy?: string;
  sortDir: SortDirection;
  onChange: (sortBy: string, sortDir: SortDirection) => void;
}

/** What the query behind the rows is doing. At most one of loading and error is shown. */
export interface DataTableState {
  isLoading?: boolean;
  /** The error of the query. Shown in place of the rows, with a retry. */
  error?: unknown;
  onRetry?: () => void;
}

export interface DataTableProps<TRow> {
  /** Names the table for screen readers, e.g. "Danh sách phòng ban". */
  caption: string;
  columns: readonly DataColumn<TRow>[];
  rows: readonly TRow[];
  /** The entity's id, never the row's index. */
  getRowKey: (row: TRow) => string;
  /** When given, each row opens this address. The first column holds the link. */
  getRowHref?: (row: TRow) => string;
  sort?: DataTableSort;
  state?: DataTableState;
  /** Shown when there are no rows: an `EmptyState` with the reason and the next step. */
  empty: React.ReactNode;
}

const SKELETON_ROWS = 5;
const CELL = 'px-4 py-3 align-middle';

/**
 * The one table of the app. It does not fetch: the caller passes rows, the loading flag
 * and the error, and the table shows exactly one of the rows, a skeleton, an error with a
 * retry, or the empty state. Sorting is controlled (the caller writes it to the URL).
 */
export function DataTable<TRow>({
  caption,
  columns,
  rows,
  getRowKey,
  getRowHref,
  sort,
  state = {},
  empty,
}: DataTableProps<TRow>) {
  const { isLoading = false, error, onRetry } = state;
  const sortBy = sort?.sortBy;
  const sortDir = sort?.sortDir ?? 'asc';

  function handleSort(column: DataColumn<TRow>) {
    if (!column.sortKey || !sort) return;
    const next: SortDirection =
      sortBy === column.sortKey && sortDir === 'asc' ? 'desc' : 'asc';
    sort.onChange(column.sortKey, next);
  }

  const span = columns.length;

  return (
    // A table wider than its card scrolls sideways: the region takes the keyboard focus so
    // the arrow keys can scroll it, and has a name so a screen reader says what it is.
    <div
      className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-hf-ring focus-visible:ring-inset"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      {isLoading && (
        <p role="status" className="sr-only">
          Đang tải dữ liệu
        </p>
      )}
      <table className="w-full border-collapse text-sm text-hf-text-body">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-hf-bg-surface">
          <tr>
            {columns.map((column) => {
              const sorted = column.sortKey && column.sortKey === sortBy;
              const ariaSort = !column.sortKey
                ? undefined
                : sorted
                  ? sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    'px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-hf-text-muted',
                    column.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {column.sortKey ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-hf-badge outline-none hover:text-hf-text-heading focus-visible:ring-2 focus-visible:ring-hf-ring',
                        sorted && 'text-hf-text-heading',
                      )}
                    >
                      {column.header}
                      {sorted ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown
                          className="size-3.5"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={index} className="border-t border-hf-border">
                {columns.map((column) => (
                  <td key={column.id} className={CELL}>
                    <Skeleton className="h-4 w-full max-w-40" />
                  </td>
                ))}
              </tr>
            ))
          ) : error !== undefined && error !== null ? (
            <tr className="border-t border-hf-border">
              <td colSpan={span} className="px-4 py-10 text-center">
                <p role="alert" className="text-sm text-hf-text-heading">
                  {describeApiError(error).message}
                </p>
                {onRetry && (
                  <Button className="mt-3" onClick={onRetry}>
                    Thử lại
                  </Button>
                )}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr className="border-t border-hf-border">
              <td colSpan={span}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => {
              const href = getRowHref?.(row);
              return (
                <tr
                  key={getRowKey(row)}
                  className={cn(
                    'relative border-t border-hf-border',
                    href && 'hover:bg-hf-bg-surface',
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        CELL,
                        column.align === 'right' && 'text-right tabular-nums',
                        column.interactive && 'relative z-10',
                      )}
                    >
                      {href && index === 0 ? (
                        // The link stretches over the whole row, so the row is one big target
                        // that still works with the keyboard and "open in a new tab".
                        <Link
                          href={href}
                          className="font-medium text-hf-text-heading outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-hf-ring focus-visible:after:ring-inset"
                        >
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
