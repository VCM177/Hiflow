import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListPagination, pageItems } from './list-pagination';

const meta = (page: number, total: number, limit = 10) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('keeps the first, the last and the current page with its neighbours', () => {
    expect(pageItems(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('fills a hole of one page instead of drawing a gap', () => {
    // 1 _ 3: page 2 is shown rather than a gap.
    expect(pageItems(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9]);
  });

  it('has one page for a single page', () => {
    expect(pageItems(1, 1)).toEqual([1]);
  });
});

describe('ListPagination', () => {
  it('says which rows are shown out of the total', () => {
    render(<ListPagination meta={meta(2, 25)} onPageChange={() => {}} />);
    expect(
      screen.getByText('Hiển thị 11–20 trong 25 kết quả'),
    ).toBeInTheDocument();
  });

  it('clips the last page to the total', () => {
    render(<ListPagination meta={meta(3, 25)} onPageChange={() => {}} />);
    expect(
      screen.getByText('Hiển thị 21–25 trong 25 kết quả'),
    ).toBeInTheDocument();
  });

  it('groups thousands the Vietnamese way', () => {
    render(
      <ListPagination meta={meta(1, 1234, 100)} onPageChange={() => {}} />,
    );
    expect(screen.getByText(/trong 1\.234 kết quả/)).toBeInTheDocument();
  });

  it('marks the current page and names every control', () => {
    render(<ListPagination meta={meta(2, 40)} onPageChange={() => {}} />);
    expect(
      screen.getByRole('navigation', { name: 'Phân trang' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Trang 3' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('goes to the clicked page, the previous and the next', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<ListPagination meta={meta(2, 40)} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Trang 4' }));
    await user.click(screen.getByRole('button', { name: 'Trang trước' }));
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect(onPageChange.mock.calls).toEqual([[4], [1], [3]]);
  });

  it('does not report a click on the current page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<ListPagination meta={meta(2, 40)} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Trang 2' }));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(
      <ListPagination meta={meta(1, 40)} onPageChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled();

    rerender(<ListPagination meta={meta(4, 40)} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(
      <ListPagination meta={meta(1, 0)} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
