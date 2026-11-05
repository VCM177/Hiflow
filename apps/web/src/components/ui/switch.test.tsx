import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './switch';

describe('Switch', () => {
  it('toggles with a click and reports the new value', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Switch aria-label="Nhận thông báo" onCheckedChange={onCheckedChange} />,
    );

    await user.click(screen.getByRole('switch', { name: 'Nhận thông báo' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole('switch', { name: 'Nhận thông báo' }),
    ).toBeChecked();
  });

  it('toggles with the Space key while focused', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Tự động gửi" />);
    const sw = screen.getByRole('switch', { name: 'Tự động gửi' });
    sw.focus();
    await user.keyboard(' ');
    expect(sw).toBeChecked();
  });

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Khóa" disabled />);
    await user.click(screen.getByRole('switch', { name: 'Khóa' }));
    expect(screen.getByRole('switch', { name: 'Khóa' })).not.toBeChecked();
  });
});
