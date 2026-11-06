import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';

import RootError from './error';
import GlobalError from './global-error';
import CareersError from './careers/error';

// The error pages are shown when something else has failed, so they must not depend on
// anything that could fail too: each one is rendered alone and offers a way back.
describe('error pages', () => {
  it('the app-wide page offers a retry', async () => {
    const retry = vi.fn();
    render(<RootError retry={retry} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Có lỗi xảy ra' }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('the careers page says the list is unavailable, without showing the failure', () => {
    render(
      <TooltipProvider>
        <CareersError retry={() => {}} />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Chưa tải được danh sách vị trí',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về trang vị trí' }),
    ).toHaveAttribute('href', '/careers');
    expect(
      screen.queryByText(/Error|stack|ECONNREFUSED/i),
    ).not.toBeInTheDocument();
  });

  it('the last-resort page brings its own document and a retry', async () => {
    const retry = vi.fn();
    render(<GlobalError retry={retry} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Có lỗi xảy ra',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
