import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ApplicationStatus,
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import { createApplication, fetchApplications } from './application-api';
import { ApplicationsPage } from './applications-page';

const push = vi.fn();
let role: UserRole = UserRole.RECRUITER;
let currentQuery = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/applications',
  useSearchParams: () => new URLSearchParams(currentQuery),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => {
    const granted = ROLE_PERMISSIONS[role] as readonly Permission[];
    return {
      user: { id: 'me', role },
      can: (p: Permission) => can(granted, p),
    };
  },
}));
vi.mock('@/features/catalogs/options', () => ({
  useDepartmentOptions: () => ({
    options: [{ value: 'd1', label: 'Tài chính' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/users/options', () => ({
  useUserOptions: () => ({
    options: [{ value: 'me', label: 'Tuyển dụng A' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/candidates/candidate-api', () => ({
  fetchCandidates: vi.fn().mockResolvedValue({
    items: [{ id: 'c1', fullName: 'Nguyễn Văn An', email: 'an@example.com' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }),
}));
vi.mock('@/features/jobs/job-api', () => ({
  fetchJobs: vi.fn().mockResolvedValue({
    items: [{ id: 'j1', title: 'Kế toán' }],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  }),
}));
vi.mock('./application-api', () => ({
  fetchApplications: vi.fn(),
  createApplication: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const row = {
  id: 'a1',
  candidate: { id: 'c1', fullName: 'Nguyễn Văn An', email: 'an@example.com' },
  job: { id: 'j1', title: 'Kế toán', status: 'OPEN' },
  status: ApplicationStatus.NEW,
  appliedAt: '2026-11-02T03:00:00.000Z',
  assignee: null,
};

function renderPage(as: UserRole = UserRole.RECRUITER) {
  role = as;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ApplicationsPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = '';
  vi.mocked(fetchApplications).mockResolvedValue({
    items: [row],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  } as never);
});

describe('ApplicationsPage', () => {
  it('lists candidate, job, status, date and owner, each row opening the application', async () => {
    renderPage();
    const line = (await screen.findByText('Nguyễn Văn An')).closest('tr')!;
    expect(within(line).getByText('Kế toán')).toBeInTheDocument();
    expect(within(line).getByText('Mới')).toBeInTheDocument();
    expect(within(line).getByText('Chưa phân công')).toBeInTheDocument();
    expect(within(line).getByRole('link')).toHaveAttribute(
      'href',
      '/applications/a1',
    );
  });

  it('reads the status filter from the address (the dashboard links here)', async () => {
    currentQuery = 'status=NEW';
    renderPage();
    await screen.findByText('Nguyễn Văn An');
    expect(fetchApplications).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NEW' }),
      expect.anything(),
    );
  });

  it('drops a status that is not one of ours', async () => {
    currentQuery = 'status=BOGUS';
    renderPage();
    await screen.findByText('Nguyễn Văn An');
    expect(fetchApplications).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
      expect.anything(),
    );
  });

  it('shows no add button to HR', async () => {
    renderPage(UserRole.HR_MANAGER);
    await screen.findByText('Nguyễn Văn An');
    expect(
      screen.queryByRole('button', { name: 'Thêm hồ sơ' }),
    ).not.toBeInTheDocument();
  });

  it('adds an application for the chosen candidate and job, owned by the recruiter', async () => {
    vi.mocked(createApplication).mockResolvedValue({ id: 'a9' } as never);
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(screen.getAllByRole('button', { name: 'Thêm hồ sơ' })[0]);
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm hồ sơ ứng tuyển',
    });
    await user.click(
      within(dialog).getByRole('combobox', { name: /Ứng viên/ }),
    );
    await user.click(
      await screen.findByRole('option', { name: /Nguyễn Văn An/ }),
    );
    await user.click(
      within(dialog).getByRole('combobox', { name: /Tin tuyển dụng/ }),
    );
    await user.click(await screen.findByRole('option', { name: 'Kế toán' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Thêm hồ sơ' }),
    );
    await waitFor(() => expect(createApplication).toHaveBeenCalled());
    expect(createApplication).toHaveBeenCalledWith({
      candidateId: 'c1',
      jobId: 'j1',
      assigneeId: 'me',
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/applications/a9'));
  });

  it('shows a duplicate application inside the dialog', async () => {
    vi.mocked(createApplication).mockRejectedValue(
      new ApiError(409, ['Ứng viên đã nộp hồ sơ vào tin này']),
    );
    const user = renderPage();
    await screen.findByText('Nguyễn Văn An');
    await user.click(screen.getAllByRole('button', { name: 'Thêm hồ sơ' })[0]);
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm hồ sơ ứng tuyển',
    });
    await user.click(
      within(dialog).getByRole('combobox', { name: /Ứng viên/ }),
    );
    await user.click(
      await screen.findByRole('option', { name: /Nguyễn Văn An/ }),
    );
    await user.click(
      within(dialog).getByRole('combobox', { name: /Tin tuyển dụng/ }),
    );
    await user.click(await screen.findByRole('option', { name: 'Kế toán' }));
    await user.click(
      within(dialog).getByRole('button', { name: 'Thêm hồ sơ' }),
    );
    expect(
      await within(dialog).findByText('Ứng viên đã nộp hồ sơ vào tin này'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
