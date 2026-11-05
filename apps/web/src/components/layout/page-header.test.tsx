import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('shows the title as the page heading', () => {
    render(<PageHeader title="Tin tuyển dụng" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tin tuyển dụng' }),
    ).toBeInTheDocument();
  });

  it('shows the description and the actions when given', () => {
    render(
      <PageHeader
        title="Ứng viên"
        description="Danh sách ứng viên"
        actions={<button>Thêm ứng viên</button>}
      />,
    );
    expect(screen.getByText('Danh sách ứng viên')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Thêm ứng viên' }),
    ).toBeInTheDocument();
  });

  it('leaves out what is not given', () => {
    const { container } = render(<PageHeader title="Báo cáo" />);
    expect(container.querySelector('p')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
