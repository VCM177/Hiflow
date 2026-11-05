import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

const VARIANTS = [
  ['primary', 'text-hf-primary'],
  ['success', 'text-hf-success-text'],
  ['warning', 'text-hf-warning-text'],
  ['destructive', 'text-hf-destructive-text'],
  ['neutral', 'text-hf-neutral-text'],
] as const;

describe('Badge', () => {
  it.each(VARIANTS)(
    'renders the %s variant with its text token',
    (variant, textClass) => {
      render(<Badge variant={variant}>Trạng thái</Badge>);
      const badge = screen.getByText('Trạng thái');
      expect(badge).toHaveClass(textClass);
      expect(badge.className).toContain('rounded-hf-badge');
    },
  );

  it('falls back to the neutral variant', () => {
    render(<Badge>Đã đóng</Badge>);
    expect(screen.getByText('Đã đóng')).toHaveClass('text-hf-neutral-text');
  });

  it('always shows its label as text', () => {
    render(<Badge variant="warning">Đang chờ duyệt</Badge>);
    expect(screen.getByText('Đang chờ duyệt')).toBeInTheDocument();
  });
});
