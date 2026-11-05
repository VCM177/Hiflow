import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLE_PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

const signOut = vi.fn();
let role: UserRole = UserRole.HR_MANAGER;

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({
    user: {
      id: 'u1',
      email: 'user@example.com',
      fullName: 'Nguyễn Văn An',
      role,
      departmentId: null,
      permissions: ROLE_PERMISSIONS[role],
    },
    signOut,
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    signOut.mockReset();
    role = UserRole.HR_MANAGER;
  });

  it('shows the page content and a skip link to it', () => {
    render(
      <AppShell>
        <p>Nội dung trang</p>
      </AppShell>,
    );
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bỏ qua menu' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('builds the menu from the permissions of the signed-in user', () => {
    role = UserRole.INTERVIEWER;
    render(<AppShell>x</AppShell>);
    const nav = screen.getByRole('navigation', { name: 'Menu chính' });
    expect(nav).toHaveTextContent('Ứng viên');
    expect(nav).toHaveTextContent('Lịch phỏng vấn');
    expect(nav).not.toHaveTextContent('Báo cáo');
    expect(nav).not.toHaveTextContent('Người dùng');
  });

  it('collapses and remembers it', async () => {
    const user = userEvent.setup();
    render(<AppShell>x</AppShell>);
    await user.click(screen.getByRole('button', { name: 'Thu gọn menu' }));
    expect(
      screen.getByRole('button', { name: 'Mở rộng menu' }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('hf-sidebar-collapsed')).toBe('1');
  });

  it('signs out from the account menu', async () => {
    const user = userEvent.setup();
    render(<AppShell>x</AppShell>);
    await user.click(screen.getByRole('button', { name: /Tài khoản của/ }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Đăng xuất' }),
    );
    expect(signOut).toHaveBeenCalledOnce();
  });
});
