import { render, screen } from '@testing-library/react';
import { PERMISSIONS, type Permission } from '@hiflow/shared-types';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';

import { PermissionGate } from './permission-gate';

let granted: Permission[] = [];

vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({
    can: (permission: Permission) => granted.includes(permission),
  }),
}));

function renderGate(reason?: string) {
  render(
    <TooltipProvider>
      <PermissionGate
        permission={PERMISSIONS.department.create}
        disabledReason={reason}
      >
        <Button>Thêm phòng ban</Button>
      </PermissionGate>
    </TooltipProvider>,
  );
}

describe('PermissionGate', () => {
  it('does not render the control for a role that never has the permission', () => {
    granted = [];
    renderGate();
    expect(screen.queryByRole('button', { name: 'Thêm phòng ban' })).toBeNull();
  });

  it('renders the control as is when permitted and not locked', () => {
    granted = [PERMISSIONS.department.create];
    renderGate();
    expect(
      screen.getByRole('button', { name: 'Thêm phòng ban' }),
    ).toBeEnabled();
  });

  it('keeps the control visible but disabled, with the reason, when the record locks it', () => {
    granted = [PERMISSIONS.department.create];
    renderGate('Phòng ban đang được sử dụng');
    const button = screen.getByRole('button', { name: 'Thêm phòng ban' });
    expect(button).toBeDisabled();
    // The reason is readable without hovering: it is the wrapper's description.
    expect(
      screen.getByText('Phòng ban đang được sử dụng', { selector: '.sr-only' }),
    ).toBeInTheDocument();
    expect(button.parentElement).toHaveAttribute('tabindex', '0');
    expect(button.parentElement).toHaveAccessibleDescription(
      'Phòng ban đang được sử dụng',
    );
  });

  it('hides a locked control from a role without the permission, whatever the reason', () => {
    granted = [];
    renderGate('Đang bị khóa');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Đang bị khóa')).toBeNull();
  });
});
