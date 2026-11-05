import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ROLE_PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { sessionQueryKey } from '@/lib/auth/session';

import { LoginForm } from './login-form';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }));

const interviewer = {
  id: 'u9',
  email: 'interviewer@example.com',
  fullName: 'Phỏng vấn viên',
  role: UserRole.INTERVIEWER,
  departmentId: null,
  permissions: ROLE_PERMISSIONS[UserRole.INTERVIEWER],
};
const admin = { ...interviewer, role: UserRole.ADMIN, permissions: ['*'] };

function setup(next?: string) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <LoginForm next={next} />
    </QueryClientProvider>,
  );
  return { client, user: userEvent.setup() };
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  email = 'a@example.com',
  password = 'secret-1',
) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for both fields before calling the API', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Vui lòng nhập email.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('rejects an email that is not an email', async () => {
    const { user } = setup();
    await fill(user, 'not-an-email');
    expect(await screen.findByText('Email không hợp lệ.')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('sends the trimmed lower-case email and goes to the page asked for', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ user: admin });
    const { user, client } = setup('/jobs?status=OPEN');
    await fill(user, '  A@Example.com ');
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/jobs?status=OPEN'),
    );
    expect(apiRequest).toHaveBeenCalledWith('POST', '/auth/login', {
      body: { email: 'a@example.com', password: 'secret-1' },
    });
    expect(client.getQueryData(sessionQueryKey)).toEqual(admin);
  });

  it('goes to the landing page of the role when no page was asked for', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ user: interviewer });
    const { user } = setup();
    await fill(user);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/interviews?result=PENDING'),
    );
  });

  it('shows one generic line for a wrong login, keeps the email, clears the password', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(401, ['x']));
    const { user } = setup();
    await fill(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email hoặc mật khẩu không đúng.',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('a@example.com');
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('');
    expect(screen.getByLabelText('Mật khẩu')).toHaveFocus();
    expect(replace).not.toHaveBeenCalled();
  });

  it('says the account is locked on 403', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(403, ['x']));
    const { user } = setup();
    await fill(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tài khoản đã bị khóa',
    );
  });

  it('counts down after a 429 and blocks the button meanwhile', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(429, [], 30));
    const { user } = setup();
    await fill(user);
    const button = await screen.findByRole('button', {
      name: /Thử lại sau 30 giây/,
    });
    expect(button).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Thử lại sau 30 giây.');
  });

  it('keeps the input and shows a generic message on a server error', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError(500, []));
    const { user } = setup();
    await fill(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra');
    expect(screen.getByLabelText('Email')).toHaveValue('a@example.com');
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });
});
