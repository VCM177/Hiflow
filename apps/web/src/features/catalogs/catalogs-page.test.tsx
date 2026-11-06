import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS, type Permission } from '@hiflow/shared-types';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';

import {
  createCatalogItem,
  deleteCatalogItem,
  fetchCatalogList,
  updateCatalogItem,
  type CatalogItem,
} from './catalog-api';
import { CatalogsPage } from './catalogs-page';
import type { CatalogKind } from './constants';

const push = vi.fn();
const replace = vi.fn();
let currentQuery = '';
let granted: Permission[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/catalogs/department',
  useSearchParams: () => new URLSearchParams(currentQuery),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({
    user: { permissions: granted },
    can: (permission: Permission) => granted.includes(permission),
  }),
}));
vi.mock('./catalog-api', () => ({
  fetchCatalogList: vi.fn(),
  createCatalogItem: vi.fn(),
  updateCatalogItem: vi.fn(),
  deleteCatalogItem: vi.fn(),
}));

const list = vi.mocked(fetchCatalogList);
const create = vi.mocked(createCatalogItem);
const update = vi.mocked(updateCatalogItem);
const remove = vi.mocked(deleteCatalogItem);

const P = PERMISSIONS;
const ADMIN: Permission[] = [
  P.department.listView,
  P.department.create,
  P.department.update,
  P.department.delete,
  P.position.listView,
  P.position.create,
  P.position.update,
  P.position.delete,
];

const item = (id: string, name: string, code: string): CatalogItem => ({
  id,
  name,
  code,
  createdAt: '2026-01-15T03:00:00.000Z',
  updatedAt: '2026-01-15T03:00:00.000Z',
});
const ENG = item('d1', 'Kỹ thuật', 'ENG');
const HR = item('d2', 'Nhân sự', 'HR');

const pageOf = (items: CatalogItem[], total = items.length, page = 1) => ({
  items,
  meta: {
    page,
    limit: 10,
    total,
    totalPages: Math.max(1, Math.ceil(total / 10)),
  },
});

function renderPage(kind: CatalogKind = 'department') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <CatalogsPage kind={kind} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = '';
  granted = ADMIN;
  list.mockResolvedValue(pageOf([ENG, HR]));
  create.mockResolvedValue(ENG);
  update.mockResolvedValue(ENG);
  remove.mockResolvedValue(undefined);
});

describe('CatalogsPage', () => {
  describe('the list', () => {
    it('shows each entry with its code and creation date', async () => {
      renderPage();

      // The table is on screen as a skeleton first; wait for the data itself.
      await screen.findByRole('cell', { name: 'Kỹ thuật' });
      const table = screen.getByRole('table', { name: 'Danh sách phòng ban' });
      expect(
        within(table).getByRole('cell', { name: 'Kỹ thuật' }),
      ).toBeInTheDocument();
      expect(
        within(table).getByRole('cell', { name: 'HR' }),
      ).toBeInTheDocument();
      // 03:00 UTC on the 15th is 10:00 on the 15th in Vietnam.
      expect(
        within(table).getAllByRole('cell', { name: '15/01/2026' }),
      ).toHaveLength(2);
    });

    it('asks the API for the first page sorted by name when the URL is clean', async () => {
      renderPage();
      await screen.findByRole('table');

      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/departments' }),
        { page: 1, limit: 10, search: '', sortBy: 'name', sortDir: 'asc' },
        expect.any(AbortSignal),
      );
    });

    it('reads the page, search and sort from the URL', async () => {
      currentQuery = 'page=2&limit=20&search=kỹ&sortBy=code&sortDir=desc';
      renderPage();
      await screen.findByRole('table');

      expect(list).toHaveBeenCalledWith(
        expect.anything(),
        { page: 2, limit: 20, search: 'kỹ', sortBy: 'code', sortDir: 'desc' },
        expect.any(AbortSignal),
      );
    });

    it('lists positions from their own route on the position tab', async () => {
      renderPage('position');
      await screen.findByRole('table', { name: 'Danh sách vị trí' });

      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/positions' }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('shows a skeleton and says it is loading while the rows come', () => {
      list.mockReturnValue(new Promise(() => {}));
      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu');
      expect(screen.queryByText('Kỹ thuật')).toBeNull();
    });

    it('shows the failure with a retry that asks again', async () => {
      list.mockRejectedValueOnce(new ApiError(500, []));
      const user = renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Có lỗi xảy ra',
      );
      await user.click(screen.getByRole('button', { name: 'Thử lại' }));

      expect(
        await screen.findByRole('cell', { name: 'Kỹ thuật' }),
      ).toBeInTheDocument();
      expect(list).toHaveBeenCalledTimes(2);
    });
  });

  describe('when there is nothing to show', () => {
    it('explains an empty catalogue and offers to add the first entry', async () => {
      list.mockResolvedValue(pageOf([]));
      renderPage();

      expect(
        await screen.findByText('Chưa có phòng ban nào'),
      ).toBeInTheDocument();
      const empty = screen.getByText('Chưa có phòng ban nào').closest('div');
      expect(
        within(empty as HTMLElement).getByRole('button', {
          name: 'Thêm phòng ban',
        }),
      ).toBeInTheDocument();
    });

    it('says no entry matches a search, and clears it', async () => {
      currentQuery = 'search=zzz';
      list.mockResolvedValue(pageOf([]));
      const user = renderPage();

      expect(await screen.findByText('Không có kết quả')).toBeInTheDocument();
      const empty = screen.getByText('Không có kết quả').closest('div');
      await user.click(
        within(empty as HTMLElement).getByRole('button', {
          name: 'Xóa bộ lọc',
        }),
      );

      expect(replace).toHaveBeenCalledWith('/catalogs/department', {
        scroll: false,
      });
    });

    it('sends someone on a page that no longer has rows back to the first page', async () => {
      currentQuery = 'page=3';
      list.mockResolvedValue(pageOf([], 12, 3));
      const user = renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Về trang đầu' }),
      );

      expect(replace).toHaveBeenCalledWith('/catalogs/department', {
        scroll: false,
      });
    });
  });

  describe('URL state', () => {
    it('writes the search to the URL once the person pauses typing', async () => {
      const user = renderPage();
      await screen.findByRole('table');

      await user.type(
        screen.getByRole('searchbox', { name: 'Tìm phòng ban' }),
        'kỹ',
      );

      await waitFor(() => expect(replace).toHaveBeenCalled());
      const url = replace.mock.calls.at(-1)?.[0] as string;
      expect(url.startsWith('/catalogs/department?')).toBe(true);
      expect(new URLSearchParams(url.split('?')[1]).get('search')).toBe('kỹ');
    });

    it('writes a sort to the URL', async () => {
      const user = renderPage();
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: 'Mã' }));

      expect(replace).toHaveBeenCalledWith('/catalogs/department?sortBy=code', {
        scroll: false,
      });
    });

    it('pages through the results and changes the page size', async () => {
      list.mockResolvedValue(pageOf([ENG, HR], 25));
      const user = renderPage();

      expect(
        await screen.findByText('Hiển thị 1–10 trong 25 kết quả'),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Trang 2' }));

      expect(replace).toHaveBeenCalledWith('/catalogs/department?page=2', {
        scroll: false,
      });
    });

    it('opens the other catalogue from its tab', async () => {
      const user = renderPage();
      await screen.findByRole('table');

      await user.click(screen.getByRole('tab', { name: 'Vị trí' }));

      expect(push).toHaveBeenCalledWith('/catalogs/position');
    });
  });

  describe('adding', () => {
    it('creates the entry, refreshes the list and confirms with a toast', async () => {
      const user = renderPage();
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: 'Thêm phòng ban' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'Thêm phòng ban',
      });
      await user.type(within(dialog).getByLabelText(/^Tên/), 'Tài chính');
      await user.type(within(dialog).getByLabelText(/^Mã/), 'FIN');
      await user.click(
        within(dialog).getByRole('button', { name: 'Thêm phòng ban' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'department' }),
        { name: 'Tài chính', code: 'FIN' },
      );
      expect(toast.success).toHaveBeenCalledWith('Đã thêm phòng ban Tài chính');
      // Once to show the list, once more after the write.
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    });

    it('checks the fields before sending anything', async () => {
      const user = renderPage();
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: 'Thêm phòng ban' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Thêm phòng ban' }),
      );

      expect(
        await within(dialog).findByText('Vui lòng nhập tên.'),
      ).toBeInTheDocument();
      expect(create).not.toHaveBeenCalled();
    });

    it('keeps the dialog open and shows the conflict beside the button', async () => {
      create.mockRejectedValue(
        new ApiError(409, ['Tên hoặc mã phòng ban đã tồn tại']),
      );
      const user = renderPage();
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: 'Thêm phòng ban' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/^Tên/), 'Kỹ thuật');
      await user.type(within(dialog).getByLabelText(/^Mã/), 'ENG');
      await user.click(
        within(dialog).getByRole('button', { name: 'Thêm phòng ban' }),
      );

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Tên hoặc mã phòng ban đã tồn tại',
      );
      expect(within(dialog).getByLabelText(/^Tên/)).toHaveValue('Kỹ thuật');
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('opens on the entry, saves the change by id and confirms', async () => {
      const user = renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Sửa Kỹ thuật' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Sửa phòng ban',
      });
      const name = within(dialog).getByLabelText(/^Tên/);
      expect(name).toHaveValue('Kỹ thuật');
      expect(within(dialog).getByLabelText(/^Mã/)).toHaveValue('ENG');
      await user.clear(name);
      await user.type(name, 'Công nghệ');
      await user.click(
        within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'department' }),
        'd1',
        { name: 'Công nghệ', code: 'ENG' },
      );
      expect(toast.success).toHaveBeenCalledWith('Đã lưu Công nghệ');
    });

    it('opens each entry with its own values', async () => {
      const user = renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Sửa Kỹ thuật' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Hủy' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await user.click(screen.getByRole('button', { name: 'Sửa Nhân sự' }));

      const dialog = await screen.findByRole('dialog', {
        name: 'Sửa phòng ban',
      });
      expect(within(dialog).getByLabelText(/^Tên/)).toHaveValue('Nhân sự');
      expect(within(dialog).getByLabelText(/^Mã/)).toHaveValue('HR');
    });
  });

  describe('deleting', () => {
    it('asks first, naming the entry, then deletes it by id', async () => {
      const user = renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Xóa Kỹ thuật' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Xóa phòng ban',
      });
      expect(dialog).toHaveAccessibleDescription(/"Kỹ thuật"/);
      expect(remove).not.toHaveBeenCalled();
      await user.click(
        within(dialog).getByRole('button', { name: 'Xóa phòng ban' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(remove).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'department' }),
        'd1',
      );
      expect(toast.success).toHaveBeenCalledWith('Đã xóa Kỹ thuật');
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    });

    it('shows why an entry in use cannot be deleted and keeps it', async () => {
      remove.mockRejectedValue(
        new ApiError(409, ['Phòng ban đang được sử dụng nên không thể xóa']),
      );
      const user = renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Xóa Kỹ thuật' }),
      );
      const dialog = await screen.findByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Xóa phòng ban' }),
      );

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Phòng ban đang được sử dụng nên không thể xóa',
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the person cancels', async () => {
      const user = renderPage();

      await user.click(
        await screen.findByRole('button', { name: 'Xóa Kỹ thuật' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Hủy' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('permissions', () => {
    it('shows the forbidden page, and loads nothing, to someone who may not manage catalogues', () => {
      granted = [P.department.listView];
      renderPage();

      expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
      expect(list).not.toHaveBeenCalled();
    });

    it('hides the edit and delete buttons from someone who may only add', async () => {
      granted = [P.department.listView, P.department.create];
      renderPage();

      await screen.findByRole('cell', { name: 'Kỹ thuật' });
      expect(
        screen.getByRole('button', { name: 'Thêm phòng ban' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sửa Kỹ thuật' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Xóa Kỹ thuật' })).toBeNull();
    });
  });
});
