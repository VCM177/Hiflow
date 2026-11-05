import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { initialsOf, Topbar } from './topbar';

describe('initialsOf', () => {
  it.each([
    ['Nguyễn Văn An', 'VA'],
    ['Đỗ Thị Bình', 'TB'],
    ['  Lan  ', 'L'],
    ['', ''],
  ])('takes the initials of %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('Topbar', () => {
  function setup() {
    const onSignOut = vi.fn();
    render(
      <Topbar
        fullName="Nguyễn Văn An"
        email="an@example.com"
        roleLabel="HR"
        onSignOut={onSignOut}
      />,
    );
    return { onSignOut, user: userEvent.setup() };
  }

  it('opens the account menu with who is signed in', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Tài khoản của Nguyễn Văn An' }),
    );
    expect(await screen.findByText('HR · an@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Đăng xuất' }),
    ).toBeInTheDocument();
  });

  it('signs out from the menu', async () => {
    const { user, onSignOut } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Tài khoản của Nguyễn Văn An' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Đăng xuất' }),
    );
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('opens and picks with the keyboard', async () => {
    const { user, onSignOut } = setup();
    screen.getByRole('button', { name: /Tài khoản của/ }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menuitem', { name: 'Đăng xuất' });
    await user.keyboard('{Enter}');
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
