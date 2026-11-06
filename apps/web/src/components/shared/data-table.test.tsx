import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { DataTable, type DataColumn } from './data-table';

interface Row {
  id: string;
  name: string;
  count: number;
}

const ROWS: Row[] = [
  { id: 'a1', name: 'Kỹ thuật', count: 12 },
  { id: 'b2', name: 'Nhân sự', count: 3 },
];

const COLUMNS: DataColumn<Row>[] = [
  { id: 'name', header: 'Tên', cell: (r) => r.name, sortKey: 'name' },
  {
    id: 'count',
    header: 'Số lượng',
    cell: (r) => r.count,
    align: 'right',
    sortKey: 'count',
  },
  { id: 'note', header: 'Ghi chú', cell: () => '—' },
];

function renderTable(
  props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {},
) {
  return render(
    <DataTable
      caption="Danh sách phòng ban"
      columns={COLUMNS}
      rows={ROWS}
      getRowKey={(r) => r.id}
      empty={<p>Chưa có phòng ban</p>}
      {...props}
    />,
  );
}

describe('DataTable', () => {
  it('is a table named by its caption, with a row per record', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'Danh sách phòng ban' });
    // Header row plus two data rows.
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(
      within(table).getByRole('cell', { name: 'Kỹ thuật' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('columnheader', { name: 'Ghi chú' }),
    ).toBeInTheDocument();
  });

  it('right-aligns numbers with tabular figures', () => {
    renderTable();
    expect(screen.getByRole('cell', { name: '12' }).className).toContain(
      'text-right',
    );
    expect(screen.getByRole('cell', { name: '12' }).className).toContain(
      'tabular-nums',
    );
    expect(
      screen.getByRole('columnheader', { name: 'Số lượng' }).className,
    ).toContain('text-right');
  });

  describe('sorting', () => {
    it('only makes a header a button when it has a sort key', () => {
      renderTable();
      expect(screen.getByRole('button', { name: 'Tên' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ghi chú' })).toBeNull();
    });

    it('reports an ascending sort when a new column is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      renderTable({
        sort: { sortBy: 'name', sortDir: 'desc', onChange: onSortChange },
      });

      await user.click(screen.getByRole('button', { name: 'Số lượng' }));

      expect(onSortChange).toHaveBeenCalledWith('count', 'asc');
    });

    it('flips the direction when the sorted column is clicked again', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      const { rerender } = renderTable({
        sort: { sortBy: 'name', sortDir: 'asc', onChange: onSortChange },
      });

      await user.click(screen.getByRole('button', { name: 'Tên' }));
      expect(onSortChange).toHaveBeenLastCalledWith('name', 'desc');

      rerender(
        <DataTable
          caption="Danh sách phòng ban"
          columns={COLUMNS}
          rows={ROWS}
          getRowKey={(r) => r.id}
          empty={null}
          sort={{ sortBy: 'name', sortDir: 'desc', onChange: onSortChange }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Tên' }));
      expect(onSortChange).toHaveBeenLastCalledWith('name', 'asc');
    });

    it('announces the sort state to screen readers', () => {
      renderTable({
        sort: { sortBy: 'name', sortDir: 'asc', onChange: () => {} },
      });
      expect(screen.getByRole('columnheader', { name: 'Tên' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      expect(
        screen.getByRole('columnheader', { name: 'Số lượng' }),
      ).toHaveAttribute('aria-sort', 'none');
      expect(
        screen.getByRole('columnheader', { name: 'Ghi chú' }),
      ).not.toHaveAttribute('aria-sort');
    });
  });

  describe('row links', () => {
    it('links each row to its page from the first column', () => {
      renderTable({ getRowHref: (r) => `/catalogs/${r.id}` });
      expect(screen.getByRole('link', { name: 'Kỹ thuật' })).toHaveAttribute(
        'href',
        '/catalogs/a1',
      );
      expect(screen.getByRole('link', { name: 'Nhân sự' })).toHaveAttribute(
        'href',
        '/catalogs/b2',
      );
      expect(screen.getAllByRole('link')).toHaveLength(2);
    });

    it('has no links without an address', () => {
      renderTable();
      expect(screen.queryByRole('link')).toBeNull();
    });

    it('keeps the controls of an interactive cell clickable above the row link', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      renderTable({
        getRowHref: (r) => `/catalogs/${r.id}`,
        columns: [
          ...COLUMNS,
          {
            id: 'actions',
            header: 'Thao tác',
            interactive: true,
            cell: (r) => (
              <button onClick={() => onDelete(r.id)}>Xóa {r.name}</button>
            ),
          },
        ],
      });

      const button = screen.getByRole('button', { name: 'Xóa Kỹ thuật' });
      expect(button.closest('td')?.className).toContain('z-10');
      await user.click(button);
      expect(onDelete).toHaveBeenCalledWith('a1');
    });
  });

  describe('states', () => {
    it('shows skeleton rows and says it is loading, with no data rows', () => {
      renderTable({ state: { isLoading: true } });
      expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu');
      // Header plus five placeholders; none of the real rows.
      expect(screen.getAllByRole('row')).toHaveLength(6);
      expect(screen.queryByText('Kỹ thuật')).toBeNull();
    });

    it('shows the empty state when there are no rows', () => {
      renderTable({ rows: [] });
      expect(screen.getByText('Chưa có phòng ban')).toBeInTheDocument();
    });

    it('shows the error with a retry, instead of the rows', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      renderTable({ state: { error: new ApiError(500, []), onRetry } });

      expect(screen.getByRole('alert')).toHaveTextContent('Có lỗi xảy ra');
      expect(screen.queryByText('Kỹ thuật')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows the wait for a rate limit in the error', () => {
      renderTable({
        state: { error: new ApiError(429, [], 12), onRetry: () => {} },
      });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Thử lại sau 12 giây',
      );
    });

    it('prefers loading over a previous error and over empty', () => {
      renderTable({
        rows: [],
        state: { isLoading: true, error: new ApiError(500, []) },
      });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText('Chưa có phòng ban')).toBeNull();
    });
  });
});
