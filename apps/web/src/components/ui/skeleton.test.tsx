import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is hidden from screen readers and uses the control radius token', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const block = container.firstElementChild;
    expect(block).toHaveAttribute('aria-hidden', 'true');
    expect(block).toHaveClass('rounded-hf-control', 'bg-hf-bg-surface', 'h-4');
  });
});
