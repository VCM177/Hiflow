import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLE_PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { visibleNavGroups } from '@/config/navigation';

import { Sidebar } from './sidebar';

let pathname = '/jobs/12';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const hr = visibleNavGroups(ROLE_PERMISSIONS[UserRole.HR_MANAGER]);

function setup(collapsed = false, groups = hr) {
  const onToggle = vi.fn();
  render(
    <TooltipProvider>
      <Sidebar groups={groups} collapsed={collapsed} onToggle={onToggle} />
    </TooltipProvider>,
  );
  return { onToggle, user: userEvent.setup() };
}

describe('Sidebar', () => {
  it('lists the entries as links, grouped', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Menu chính' });
    expect(nav).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tin tuyển dụng' }),
    ).toHaveAttribute('href', '/jobs');
    expect(screen.getByText('Chính')).toBeInTheDocument();
    expect(screen.getByText('Thiết lập')).toBeInTheDocument();
  });

  it('marks the current page, including a page under it', () => {
    pathname = '/jobs/12';
    setup();
    expect(
      screen.getByRole('link', { name: 'Tin tuyển dụng' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Ứng viên' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Tổng quan' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows only the entries it is given', () => {
    setup(false, visibleNavGroups(ROLE_PERMISSIONS[UserRole.INTERVIEWER]));
    expect(screen.queryByRole('link', { name: 'Người dùng' })).toBeNull();
    expect(screen.queryByText('Thiết lập')).toBeNull();
  });

  it('keeps every link named by screen readers when collapsed', () => {
    setup(true);
    expect(
      screen.getByRole('link', { name: 'Tin tuyển dụng' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Chính')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Mở rộng menu' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('asks to toggle from the keyboard', async () => {
    const { onToggle, user } = setup();
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Thu gọn menu' });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
