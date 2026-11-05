import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

// jsdom lacks these; Radix calls them while opening and moving through options.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function Field({ onValueChange }: { onValueChange: (value: string) => void }) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger aria-label="Trạng thái">
        <SelectValue placeholder="Chọn trạng thái" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Đang mở</SelectItem>
        <SelectItem value="closed">Đã đóng</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('opens from the keyboard and selects an option with ArrowDown and Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Field onValueChange={onValueChange} />);

    const trigger = screen.getByRole('combobox', { name: 'Trạng thái' });
    trigger.focus();
    await user.keyboard('{Enter}');

    const listbox = await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('closed');
    expect(within(trigger).getByText('Đã đóng')).toBeInTheDocument();
    expect(listbox).not.toBeVisible();
  });

  it('shows the placeholder until a value is chosen', () => {
    render(<Field onValueChange={() => {}} />);
    expect(
      screen.getByRole('combobox', { name: 'Trạng thái' }),
    ).toHaveTextContent('Chọn trạng thái');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(
      <Select disabled>
        <SelectTrigger aria-label="Khóa">
          <SelectValue placeholder="Không chọn được" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Khóa' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
