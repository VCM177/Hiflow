import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { can } from '@/lib/permissions';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';

import {
  changeUserRole,
  createUser,
  fetchUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
  type UserRow,
} from './user-api';
import { UsersPage } from './users-page';

let actor = { id: 'admin-1', role: UserRole.ADMIN };
let granted: readonly Permission[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/users',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({
    user: { ...actor, permissions: granted },
    can: (permission: Permission) => can(granted, permission),
  }),
}));
vi.mock('@/features/catalogs/options', () => ({
  useDepartmentOptions: () => ({
    options: [{ value: 'd1', label: 'Kinh doanh' }],
    isLoading: false,
  }),
}));
vi.mock('./user-api', () => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  changeUserRole: vi.fn(),
  setUserActive: vi.fn(),
  resetUserPassword: vi.fn(),
}));

const row = (over: Partial<UserRow>): UserRow => ({
  id: 'u1',
  email: 'an@example.com',
  fullName: 'Nguyễn Văn An',
  role: UserRole.RECRUITER,
  departmentId: null,
  departmentName: null,
  isActive: true,
  createdAt: '2026-01-15T03:00:00.000Z',
  ...over,
});
const ADMIN_ROW = row({
  id: 'admin-1',
  fullName: 'Quản Trị',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
});
const AN = row({});
const LOCKED = row({
  id: 'u2',
  fullName: 'Lê Thị Khóa',
  email: 'k@example.com',
  isActive: false,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <UsersPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeAll(() => {
  // jsdom lacks what Radix Select calls when it opens.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  actor = { id: 'admin-1', role: UserRole.ADMIN };
  granted = ROLE_PERMISSIONS[UserRole.ADMIN] as readonly Permission[];
  vi.mocked(fetchUsers).mockResolvedValue({
    items: [ADMIN_ROW, AN, LOCKED],
    meta: { page: 1, limit: 10, total: 3, totalPages: 1 },
  });
  vi.mocked(createUser).mockResolvedValue(AN);
  vi.mocked(updateUser).mockResolvedValue(AN);
  vi.mocked(changeUserRole).mockResolvedValue(AN);
  vi.mocked(setUserActive).mockResolvedValue(AN);
  vi.mocked(resetUserPassword).mockResolvedValue(undefined);
});

describe('UsersPage', () => {
  it('lists people with role, department and state', async () => {
    renderPage();
    const line = (await screen.findByText('Nguyễn Văn An')).closest('tr')!;
    expect(within(line).getByText('Tuyển dụng')).toBeInTheDocument();
    expect(within(line).getByText('Hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Đã khóa')).toBeInTheDocument();
  });

  it('shows no access to someone who cannot list users', () => {
    granted = [];
    renderPage();
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(fetchUsers).not.toHaveBeenCalled();
  });

  it('locks role change and locking on the own row, with the reason', async () => {
    renderPage();
    await screen.findByText('Quản Trị');
    expect(
      screen.getByRole('button', { name: 'Đổi vai trò của Quản Trị' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Khóa Quản Trị' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Đổi vai trò của Nguyễn Văn An' }),
    ).toBeEnabled();
  });

  it('shows no row actions on an Admin account to HR', async () => {
    actor = { id: 'hr-1', role: UserRole.HR_MANAGER };
    granted = ROLE_PERMISSIONS[UserRole.HR_MANAGER] as readonly Permission[];
    renderPage();
    await screen.findByText('Quản Trị');
    expect(
      screen.queryByRole('button', { name: /Quản Trị/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sửa Nguyễn Văn An' }),
    ).toBeInTheDocument();
  });

  it('creates a person and reports it', async () => {
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(
      screen.getAllByRole('button', { name: 'Thêm người dùng' })[0],
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm người dùng',
    });
    await user.type(within(dialog).getByLabelText(/^Email/), 'Moi@Example.com');
    await user.type(within(dialog).getByLabelText(/^Họ và tên/), 'Phạm Mới');
    await user.type(within(dialog).getByLabelText(/^Mật khẩu/), 'Abcdef12');
    await user.click(within(dialog).getByRole('combobox', { name: /Vai trò/ }));
    await user.click(await screen.findByRole('option', { name: 'Tuyển dụng' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Thêm người dùng' }),
    );

    await waitFor(() => expect(createUser).toHaveBeenCalled());
    expect(createUser).toHaveBeenCalledWith({
      email: 'moi@example.com',
      fullName: 'Phạm Mới',
      role: UserRole.RECRUITER,
      departmentId: undefined,
      password: 'Abcdef12',
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã thêm Phạm Mới'),
    );
  });

  it('shows a duplicate email inside the dialog and keeps it open', async () => {
    vi.mocked(createUser).mockRejectedValue(
      new ApiError(409, ['Email đã được sử dụng']),
    );
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(
      screen.getAllByRole('button', { name: 'Thêm người dùng' })[0],
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm người dùng',
    });
    await user.type(within(dialog).getByLabelText(/^Email/), 'an@example.com');
    await user.type(within(dialog).getByLabelText(/^Họ và tên/), 'An');
    await user.type(within(dialog).getByLabelText(/^Mật khẩu/), 'Abcdef12');
    await user.click(within(dialog).getByRole('combobox', { name: /Vai trò/ }));
    await user.click(await screen.findByRole('option', { name: 'Tuyển dụng' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Thêm người dùng' }),
    );
    expect(
      await within(dialog).findByText('Email đã được sử dụng'),
    ).toBeInTheDocument();
  });

  it('hides the Admin role from HR in the create form', async () => {
    actor = { id: 'hr-1', role: UserRole.HR_MANAGER };
    granted = ROLE_PERMISSIONS[UserRole.HR_MANAGER] as readonly Permission[];
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(
      screen.getAllByRole('button', { name: 'Thêm người dùng' })[0],
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm người dùng',
    });
    await user.click(within(dialog).getByRole('combobox', { name: /Vai trò/ }));
    expect(
      await screen.findByRole('option', { name: 'Tuyển dụng' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Admin' }),
    ).not.toBeInTheDocument();
  });

  it('locks an account after confirmation', async () => {
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(
      screen.getByRole('button', { name: 'Khóa Nguyễn Văn An' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Khóa tài khoản',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Khóa tài khoản' }),
    );
    await waitFor(() =>
      expect(setUserActive).toHaveBeenCalledWith('u1', false),
    );
  });

  it('unlocks a locked account', async () => {
    const user = renderPage();
    await screen.findByText('Lê Thị Khóa');
    await user.click(
      screen.getByRole('button', { name: 'Mở khóa Lê Thị Khóa' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Mở khóa tài khoản',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Mở khóa' }));
    await waitFor(() => expect(setUserActive).toHaveBeenCalledWith('u2', true));
  });

  it('resets a password with a strong one only', async () => {
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(
      screen.getByRole('button', {
        name: 'Đặt lại mật khẩu của Nguyễn Văn An',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Đặt lại mật khẩu',
    });
    await user.type(within(dialog).getByLabelText(/^Mật khẩu mới/), 'yeu');
    await user.click(
      within(dialog).getByRole('button', { name: 'Đặt lại mật khẩu' }),
    );
    expect(
      await within(dialog).findByText(/ít nhất 8 ký tự/),
    ).toBeInTheDocument();
    expect(resetUserPassword).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText(/^Mật khẩu mới/));
    await user.type(within(dialog).getByLabelText(/^Mật khẩu mới/), 'Manh1234');
    await user.click(
      within(dialog).getByRole('button', { name: 'Đặt lại mật khẩu' }),
    );
    await waitFor(() =>
      expect(resetUserPassword).toHaveBeenCalledWith('u1', 'Manh1234'),
    );
  });

  it('removes the department when "không thuộc phòng ban nào" is kept', async () => {
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(screen.getByRole('button', { name: 'Sửa Nguyễn Văn An' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Sửa người dùng',
    });
    await user.clear(within(dialog).getByLabelText(/^Họ và tên/));
    await user.type(within(dialog).getByLabelText(/^Họ và tên/), 'Nguyễn An');
    await user.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );
    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('u1', {
        fullName: 'Nguyễn An',
        departmentId: null,
      }),
    );
  });

  it('changes a role', async () => {
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(
      screen.getByRole('button', { name: 'Đổi vai trò của Nguyễn Văn An' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Đổi vai trò' });
    await user.click(within(dialog).getByRole('combobox', { name: /Vai trò/ }));
    await user.click(await screen.findByRole('option', { name: 'HR' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Đổi vai trò' }),
    );
    await waitFor(() =>
      expect(changeUserRole).toHaveBeenCalledWith('u1', UserRole.HR_MANAGER),
    );
  });
});
