import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

// jsdom lacks these; Radix calls them while opening the menu.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function RowActions({
  onEdit = () => {},
  onDelete = () => {},
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Thao tác</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>Chỉnh sửa</DropdownMenuItem>
        <DropdownMenuItem disabled>Nhân bản</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Xóa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('opens from the keyboard and runs an item with Enter', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<RowActions onEdit={onEdit} />);

    screen.getByRole('button', { name: 'Thao tác' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('skips a disabled item when moving with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<RowActions />);
    screen.getByRole('button', { name: 'Thao tác' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Xóa' })).toHaveFocus();
  });

  it('marks the destructive item and does not run a disabled one', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<RowActions onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Thao tác' }));

    const remove = await screen.findByRole('menuitem', { name: 'Xóa' });
    expect(remove).toHaveAttribute('data-variant', 'destructive');
    await user.click(screen.getByRole('menuitem', { name: 'Nhân bản' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes with Esc', async () => {
    const user = userEvent.setup();
    render(<RowActions />);
    await user.click(screen.getByRole('button', { name: 'Thao tác' }));
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
  });
});
