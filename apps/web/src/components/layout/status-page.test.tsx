import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusPage } from './status-page';

describe('StatusPage', () => {
  it('shows what happened and the next step', () => {
    render(
      <StatusPage
        title="Không tìm thấy trang"
        description="Địa chỉ không tồn tại."
        actions={<button>Về trang chính</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Địa chỉ không tồn tại.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Về trang chính' }),
    ).toBeInTheDocument();
  });

  it('needs no action', () => {
    render(<StatusPage title="Lỗi" description="Mô tả" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
