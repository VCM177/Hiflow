import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('is a native button of type "button" by default, so it never submits a form', () => {
    render(<Button>Lưu</Button>);
    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('runs its handler on Enter and Space from the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Duyệt</Button>);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Duyệt' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Xóa
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('while loading: is busy, disabled, and keeps its label for screen readers', () => {
    render(<Button loading>Gửi</Button>);
    const button = screen.getByRole('button', { name: 'Gửi' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('renders its child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/jobs">Xem tin</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Xem tin' });
    expect(link).toHaveAttribute('href', '/jobs');
    expect(link).toHaveClass('rounded-hf-control');
  });

  it('uses the token classes for each variant, never a raw color', () => {
    render(<Button variant="primary">Chính</Button>);
    const classes = screen.getByRole('button', { name: 'Chính' }).className;
    expect(classes).toContain('bg-hf-primary');
    expect(classes).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});
