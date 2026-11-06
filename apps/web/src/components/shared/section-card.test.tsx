import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionCard } from './section-card';

describe('SectionCard', () => {
  it('is a region named by its title', () => {
    render(
      <SectionCard title="Thông tin chung">
        <p>Nội dung</p>
      </SectionCard>,
    );
    expect(
      screen.getByRole('region', { name: 'Thông tin chung' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Thông tin chung' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
  });

  it('shows the description and the actions in the header', () => {
    render(
      <SectionCard
        title="Ghi chú"
        description="Chỉ nhân sự thấy"
        actions={<button>Sửa</button>}
      >
        nội dung
      </SectionCard>,
    );
    expect(screen.getByText('Chỉ nhân sự thấy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
  });

  it('has no header and no region name when there is no title or action', () => {
    const { container } = render(<SectionCard>chỉ nội dung</SectionCard>);
    expect(container.querySelector('header')).toBeNull();
    expect(screen.getByText('chỉ nội dung')).toBeInTheDocument();
  });

  it('drops the content padding when flush', () => {
    render(
      <SectionCard flush>
        <p>bảng</p>
      </SectionCard>,
    );
    expect(
      screen.getByText('bảng').parentElement?.className ?? '',
    ).not.toContain('p-5');
  });
});
