import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from './spinner';

describe('Spinner', () => {
  it('announces the default loading label to screen readers', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
  });

  it('announces a custom label', () => {
    render(<Spinner label="Đang gửi" />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang gửi');
  });
});
