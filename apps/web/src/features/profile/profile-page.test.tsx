import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserRole, type AuthUser } from '@hiflow/shared-types';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionQueryKey } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/errors';

import {
  changePassword,
  fetchProfile,
  updateProfileName,
  type Profile,
} from './profile-api';
import { ProfilePage } from './profile-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./profile-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./profile-api')>()),
  fetchProfile: vi.fn(),
  updateProfileName: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ user: { permissions: [] }, can: () => false }),
}));

const profile: Profile = {
  id: 'u1',
  email: 'an@example.com',
  fullName: 'Nguyễn Văn An',
  role: UserRole.HR_MANAGER,
  departmentId: null,
  departmentName: null,
  isActive: true,
  createdAt: '2026-01-15T03:00:00.000Z',
};

let client: QueryClient;
function renderPage() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(sessionQueryKey, {
    id: 'u1',
    fullName: 'Nguyễn Văn An',
  } as AuthUser);
  render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchProfile).mockResolvedValue(profile);
  vi.mocked(updateProfileName).mockResolvedValue({
    ...profile,
    fullName: 'Nguyễn An',
  });
  vi.mocked(changePassword).mockResolvedValue(undefined);
});

describe('ProfilePage', () => {
  it('shows who the person is', async () => {
    renderPage();
    expect(
      await screen.findByDisplayValue('Nguyễn Văn An'),
    ).toBeInTheDocument();
    expect(screen.getByText('an@example.com')).toBeInTheDocument();
    expect(screen.getByText('HR')).toBeInTheDocument();
  });

  it('saves the name and refreshes the name in the session', async () => {
    const user = renderPage();
    const input = await screen.findByLabelText(/^Họ và tên/);
    const save = screen.getByRole('button', { name: 'Lưu thay đổi' });
    expect(save).toBeDisabled();
    await user.clear(input);
    await user.type(input, 'Nguyễn An');
    await user.click(save);
    await waitFor(() =>
      expect(updateProfileName).toHaveBeenCalledWith('Nguyễn An'),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã lưu họ tên'),
    );
    expect(client.getQueryData<AuthUser>(sessionQueryKey)?.fullName).toBe(
      'Nguyễn An',
    );
  });

  it('changes the password, clears the form and stays signed in', async () => {
    const user = renderPage();
    await user.type(
      await screen.findByLabelText(/^Mật khẩu hiện tại/),
      'Cu12345678',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'Moi12345678');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'Cu12345678',
        newPassword: 'Moi12345678',
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã đổi mật khẩu'),
    );
    expect(screen.getByLabelText(/^Mật khẩu hiện tại/)).toHaveValue('');
  });

  it('shows a wrong current password at that field', async () => {
    vi.mocked(changePassword).mockRejectedValue(
      new ApiError(400, ['Mật khẩu hiện tại không đúng']),
    );
    const user = renderPage();
    await user.type(
      await screen.findByLabelText(/^Mật khẩu hiện tại/),
      'Sai12345678',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'Moi12345678');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(
      await screen.findByText('Mật khẩu hiện tại không đúng'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu hiện tại/)).toHaveFocus();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('refuses a new password equal to the current one before sending', async () => {
    const user = renderPage();
    await user.type(
      await screen.findByLabelText(/^Mật khẩu hiện tại/),
      'Giong12345',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu mới/), 'Giong12345');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(
      await screen.findByText('Mật khẩu mới phải khác mật khẩu hiện tại.'),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('offers a retry when the profile fails to load', async () => {
    vi.mocked(fetchProfile).mockRejectedValue(new ApiError(500, []));
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Thử lại' }),
    ).toBeInTheDocument();
  });
});
