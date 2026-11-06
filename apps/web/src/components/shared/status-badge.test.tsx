import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge, type StatusMap } from './status-badge';

type Demo = 'OPEN' | 'CLOSED';

const MAP: StatusMap<Demo> = {
  OPEN: { label: 'Đang mở', variant: 'success' },
  CLOSED: { label: 'Đã đóng', variant: 'neutral' },
};

describe('StatusBadge', () => {
  it('shows the label from the map, never the raw status', () => {
    render(<StatusBadge status="OPEN" map={MAP} />);
    expect(screen.getByText('Đang mở')).toBeInTheDocument();
    expect(screen.queryByText('OPEN')).toBeNull();
  });

  it('takes its colour from the map entry', () => {
    const { rerender } = render(<StatusBadge status="OPEN" map={MAP} />);
    expect(screen.getByText('Đang mở').className).toContain(
      'text-hf-success-text',
    );
    rerender(<StatusBadge status="CLOSED" map={MAP} />);
    expect(screen.getByText('Đã đóng').className).toContain(
      'text-hf-neutral-text',
    );
  });

  it('shows an unknown status as neutral text instead of failing', () => {
    render(<StatusBadge status={'ARCHIVED' as Demo} map={MAP} />);
    const badge = screen.getByText('ARCHIVED');
    expect(badge.className).toContain('text-hf-neutral-text');
  });
});
