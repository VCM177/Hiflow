import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLE_PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { ApiErrorView, ErrorView, errorViewKindOf } from './api-error-view';

let role: UserRole = UserRole.HR_MANAGER;
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ user: { permissions: ROLE_PERMISSIONS[role] } }),
}));

describe('errorViewKindOf', () => {
  it.each([
    [new ApiError(403, []), 'forbidden'],
    [new ApiError(404, []), 'not-found'],
    [new ApiError(429, [], 5), 'busy'],
    [new ApiError(500, []), 'failed'],
    [new ApiError(0, []), 'failed'],
    [new Error('boom'), 'failed'],
  ])('maps %s to %s', (error, kind) => {
    expect(errorViewKindOf(error)).toBe(kind);
  });
});

describe('ErrorView', () => {
  beforeEach(() => {
    role = UserRole.HR_MANAGER;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('403: says there is no permission and offers the way home', () => {
    render(<ErrorView kind="forbidden" />);
    expect(
      screen.getByRole('heading', { name: 'Không có quyền truy cập' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Về trang chính' }),
    ).toHaveAttribute('href', '/');
  });

  it('404: does not tell missing from out of scope', () => {
    render(<ErrorView kind="not-found" />);
    expect(
      screen.getByText(
        'Trang bạn tìm không tồn tại hoặc bạn không có quyền xem.',
      ),
    ).toBeInTheDocument();
  });

  it('sends an interviewer home to the interviews awaiting a result', () => {
    role = UserRole.INTERVIEWER;
    render(<ErrorView kind="forbidden" />);
    expect(
      screen.getByRole('link', { name: 'Về trang chính' }),
    ).toHaveAttribute('href', '/interviews?result=PENDING');
  });

  it('a failure keeps the retry button and promises the input is kept', async () => {
    const onRetry = vi.fn();
    render(<ErrorView kind="failed" onRetry={onRetry} />);
    expect(screen.getByText(/không bị mất/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('429: counts down and only then lets the user retry', () => {
    vi.useFakeTimers();
    render(<ErrorView kind="busy" retryAfter={30} onRetry={() => {}} />);
    expect(
      screen.getByText('Vui lòng thử lại sau 30 giây.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled();
  });

  it('429 without Retry-After can retry at once', () => {
    render(<ErrorView kind="busy" onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });
});

describe('ApiErrorView', () => {
  it('chooses the state from the error and passes the wait on', () => {
    render(
      <ApiErrorView error={new ApiError(429, [], 12)} onRetry={() => {}} />,
    );
    expect(
      screen.getByText('Vui lòng thử lại sau 12 giây.'),
    ).toBeInTheDocument();
  });
});
