import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  JobStatus,
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import { JobDetail } from './job-detail';
import {
  fetchJob,
  fetchJobApplications,
  publishJob,
  stopJob,
  type Job,
} from './job-api';

let role: UserRole = UserRole.RECRUITER;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => {
    const granted = ROLE_PERMISSIONS[role] as readonly Permission[];
    return { user: { role }, can: (p: Permission) => can(granted, p) };
  },
}));
vi.mock('./job-api', () => ({
  fetchJob: vi.fn(),
  fetchJobApplications: vi.fn(),
  publishJob: vi.fn(),
  stopJob: vi.fn(),
  deleteJob: vi.fn(),
}));

const base: Job = {
  id: 'j1',
  requisition: { id: 'r1', code: 'REQ-1' },
  title: 'Kế toán tổng hợp',
  position: { id: 'p1', name: 'Kế toán' },
  department: { id: 'd1', name: 'Tài chính' },
  quantity: 2,
  salaryMin: null,
  salaryMax: null,
  location: 'Hà Nội',
  description: '<p>Mô tả</p><script>alert(1)</script>',
  status: JobStatus.DRAFT,
  publishedAt: null,
  createdBy: { id: 'u', name: 'Tuyển dụng' },
  applicationCount: 1,
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
};

function renderDetail(over: Partial<Job>, as: UserRole = UserRole.RECRUITER) {
  role = as;
  vi.mocked(fetchJob).mockResolvedValue({ ...base, ...over });
  vi.mocked(fetchJobApplications).mockResolvedValue({
    items: [
      {
        id: 'a1',
        candidate: {
          id: 'c1',
          fullName: 'Nguyễn Văn A',
          email: 'a@example.com',
        },
        job: { id: 'j1', title: 'Kế toán', status: 'OPEN' },
        status: 'NEW',
        appliedAt: '2026-11-02T03:00:00.000Z',
        assignee: null,
      },
    ],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  } as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <JobDetail id="j1" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const names = () =>
  [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')].map(
    (el) => el.textContent?.trim(),
  );

beforeEach(() => vi.clearAllMocks());

describe('JobDetail', () => {
  it('offers edit, publish and delete on a draft, and shows the description sanitised', async () => {
    renderDetail({});
    await screen.findByRole('heading', { name: 'Kế toán tổng hợp' });
    expect(names()).toEqual(expect.arrayContaining(['Sửa', 'Đăng tin', 'Xóa']));
    expect(screen.getByText('Mô tả')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('offers edit and stop on an open job, not publish or delete', async () => {
    renderDetail({ status: JobStatus.OPEN });
    await screen.findByRole('heading', { name: 'Kế toán tổng hợp' });
    expect(names()).toEqual(expect.arrayContaining(['Sửa', 'Ngừng đăng']));
    expect(names()).not.toContain('Đăng tin');
    expect(names()).not.toContain('Xóa');
  });

  it('offers nothing on a closed job', async () => {
    renderDetail({ status: JobStatus.CLOSED });
    await screen.findByRole('heading', { name: 'Kế toán tổng hợp' });
    for (const label of ['Sửa', 'Đăng tin', 'Ngừng đăng', 'Xóa']) {
      expect(names()).not.toContain(label);
    }
  });

  it('shows no actions to a department manager (read only)', async () => {
    renderDetail({}, UserRole.DEPT_MANAGER);
    await screen.findByRole('heading', { name: 'Kế toán tổng hợp' });
    expect(names()).not.toContain('Đăng tin');
    expect(names()).not.toContain('Sửa');
  });

  it('explains the effect of stopping before it happens', async () => {
    const user = renderDetail({ status: JobStatus.OPEN });
    vi.mocked(stopJob).mockResolvedValue(base);
    await user.click(await screen.findByRole('button', { name: 'Ngừng đăng' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ngừng đăng tin',
    });
    expect(dialog).toHaveTextContent('không còn nhận hồ sơ');
    await user.click(
      within(dialog).getByRole('button', { name: 'Ngừng đăng' }),
    );
    await waitFor(() => expect(stopJob).toHaveBeenCalledWith('j1'));
  });

  it('shows why a publish was refused, inside the dialog', async () => {
    const user = renderDetail({});
    vi.mocked(publishJob).mockRejectedValue(
      new ApiError(409, [
        'Không thể đăng tin khi yêu cầu tuyển dụng không còn ở trạng thái Đã duyệt',
      ]),
    );
    await user.click(await screen.findByRole('button', { name: 'Đăng tin' }));
    const dialog = await screen.findByRole('dialog', { name: 'Đăng tin' });
    await user.click(within(dialog).getByRole('button', { name: 'Đăng tin' }));
    expect(
      await within(dialog).findByText(/không còn ở trạng thái Đã duyệt/),
    ).toBeInTheDocument();
  });

  it('lists the applications on the second tab', async () => {
    const user = renderDetail({});
    await user.click(
      await screen.findByRole('tab', { name: /Hồ sơ đã nộp \(1\)/ }),
    );
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Mới')).toBeInTheDocument();
  });
});
