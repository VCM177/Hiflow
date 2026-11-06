import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('shows the title and the reason', () => {
    render(
      <EmptyState
        title="Chưa có phòng ban"
        description="Thêm phòng ban đầu tiên để bắt đầu."
      />,
    );
    expect(screen.getByText('Chưa có phòng ban')).toBeInTheDocument();
    expect(
      screen.getByText('Thêm phòng ban đầu tiên để bắt đầu.'),
    ).toBeInTheDocument();
  });

  it('offers the next action when there is one', () => {
    render(
      <EmptyState
        title="Không có kết quả"
        action={<button>Xóa bộ lọc</button>}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Xóa bộ lọc' }),
    ).toBeInTheDocument();
  });

  it('leaves out the reason and the action when not given', () => {
    const { container } = render(<EmptyState title="Trống" />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides its icon from screen readers', () => {
    const { container } = render(<EmptyState title="Trống" />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
