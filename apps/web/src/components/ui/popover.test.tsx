import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './popover';

function Filter() {
  return (
    <Popover>
      <PopoverTrigger>Lọc theo ngày</PopoverTrigger>
      <PopoverContent>
        <p>Chọn khoảng ngày</p>
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('opens from its trigger and shows its content', async () => {
    const user = userEvent.setup();
    render(<Filter />);
    await user.click(screen.getByRole('button', { name: 'Lọc theo ngày' }));
    expect(screen.getByText('Chọn khoảng ngày')).toBeInTheDocument();
  });

  it('closes with Esc and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Filter />);
    const trigger = screen.getByRole('button', { name: 'Lọc theo ngày' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByText('Chọn khoảng ngày')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it('opens with the keyboard (Enter on the trigger)', async () => {
    const user = userEvent.setup();
    render(<Filter />);
    screen.getByRole('button', { name: 'Lọc theo ngày' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Chọn khoảng ngày')).toBeInTheDocument();
  });
});
