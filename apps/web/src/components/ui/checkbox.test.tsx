import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

function Controlled({ onChange }: { onChange: (value: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      aria-label="Chọn tất cả"
      checked={checked}
      onCheckedChange={(value) => {
        const next = value === true;
        setChecked(next);
        onChange(next);
      }}
    />
  );
}

describe('Checkbox', () => {
  it('toggles with a click and with the Space key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    const box = screen.getByRole('checkbox', { name: 'Chọn tất cả' });
    await user.click(box);
    expect(box).toBeChecked();

    box.focus();
    await user.keyboard(' ');
    expect(box).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Khóa" disabled />);
    await user.click(screen.getByRole('checkbox', { name: 'Khóa' }));
    expect(screen.getByRole('checkbox', { name: 'Khóa' })).not.toBeChecked();
  });

  it('reports a partial selection as mixed', () => {
    render(<Checkbox aria-label="Một phần" checked="indeterminate" />);
    expect(screen.getByRole('checkbox', { name: 'Một phần' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });
});
