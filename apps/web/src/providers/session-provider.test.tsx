import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PERMISSIONS } from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { endSession, fetchSession } from '@/lib/auth/session';

import { SessionProvider, useSession } from './session-provider';

const replace = vi.fn();
const toastError = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));
vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  fetchSession: vi.fn(),
  endSession: vi.fn(),
}));

const recruiter = {
  id: 'u1',
  email: 'recruiter@example.com',
  fullName: 'Nguyễn Văn A',
  role: 'RECRUITER',
  departmentId: null,
  permissions: [PERMISSIONS.job.listView],
} as unknown as Awaited<ReturnType<typeof fetchSession>>;

function Probe() {
  const { user, can, signOut } = useSession();
  return (
    <div>
      <p>{user.fullName}</p>
      <p>{can(PERMISSIONS.job.listView) ? 'xem tin' : 'không xem tin'}</p>
      <p>
        {can(PERMISSIONS.user.listView)
          ? 'xem người dùng'
          : 'không xem người dùng'}
      </p>
      <button onClick={() => void signOut()}>Đăng xuất</button>
    </div>
  );
}

function renderProvider(
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state, then the user and what they may do', async () => {
    vi.mocked(fetchSession).mockResolvedValue(recruiter);
    renderProvider();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang tải phiên làm việc',
    );
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('xem tin')).toBeInTheDocument();
    expect(screen.getByText('không xem người dùng')).toBeInTheDocument();
  });

  it('shows an error with a retry when the session cannot be loaded', async () => {
    vi.mocked(fetchSession).mockRejectedValueOnce(new ApiError(500, []));
    vi.mocked(fetchSession).mockResolvedValueOnce(recruiter);
    renderProvider();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tải được',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
  });

  it('keeps the loading state while a 401 sends the user to login', async () => {
    vi.mocked(fetchSession).mockRejectedValue(new ApiError(401, []));
    renderProvider();
    await waitFor(() => expect(fetchSession).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('signs out: calls the API, empties the cache, goes to login', async () => {
    vi.mocked(fetchSession).mockResolvedValue(recruiter);
    vi.mocked(endSession).mockResolvedValue(undefined);
    const client = renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Đăng xuất' }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(endSession).toHaveBeenCalledOnce();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('stays signed in and says why when sign-out fails', async () => {
    vi.mocked(fetchSession).mockResolvedValue(recruiter);
    vi.mocked(endSession).mockRejectedValue(new ApiError(500, []));
    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Đăng xuất' }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
  });

  it('refuses useSession outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/SessionProvider/);
    spy.mockRestore();
  });
});
