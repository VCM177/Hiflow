import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import { fetchOverview, type Overview } from './dashboard-api';
import { DashboardPage } from './dashboard-page';

let role: UserRole = UserRole.HR_MANAGER;
let currentQuery = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(currentQuery),
}));
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
vi.mock('./dashboard-api', () => ({ fetchOverview: vi.fn() }));

const overview: Overview = {
  period: { from: '2026-10-08', to: '2026-11-06' },
  cards: {
    pendingRequisitions: 3,
    openJobs: 7,
    newApplications: 12,
    upcomingInterviews: 4,
    hiredInPeriod: 1,
  },
  funnel: [
    { stage: 'NEW', label: 'Mới', count: 40 },
    { stage: 'SCREENING', label: 'Sàng lọc', count: 20 },
    { stage: 'INTERVIEW', label: 'Phỏng vấn', count: 10 },
    { stage: 'OFFER', label: 'Đề nghị', count: 4 },
    { stage: 'HIRED', label: 'Nhận việc', count: 1 },
  ],
  outcomes: { rejected: 9, withdrawn: 2 },
  todo: [
    {
      type: 'REQUISITIONS_TO_APPROVE',
      label: 'Yêu cầu chờ duyệt',
      count: 3,
      href: '/requisitions?status=PENDING_APPROVAL',
    },
    {
      type: 'UNASSIGNED_APPLICATIONS',
      label: 'Hồ sơ chưa phân công',
      count: 5,
      href: '/applications?status=NEW',
    },
  ],
} as Overview;

function renderPage(
  as: UserRole = UserRole.HR_MANAGER,
  data: Overview = overview,
) {
  role = as;
  vi.mocked(fetchOverview).mockResolvedValue(data);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <DashboardPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = '';
});

describe('DashboardPage', () => {
  it('shows the five numbers and the period the API chose', async () => {
    renderPage();
    expect(
      await screen.findByText('Yêu cầu chờ duyệt', { selector: 'p' }),
    ).toBeInTheDocument();
    for (const [label, value] of [
      ['Tin đang tuyển', '7'],
      ['Hồ sơ mới', '12'],
      ['Phỏng vấn sắp tới', '4'],
      ['Đã nhận việc trong kỳ', '1'],
    ]) {
      expect(screen.getByText(label).nextElementSibling).toHaveTextContent(
        value,
      );
    }
    expect(
      screen.getByText(/Kỳ 08\/10\/2026 – 06\/11\/2026/),
    ).toBeInTheDocument();
  });

  it('draws the funnel with the count at the tip of every bar, and the outcomes beside it', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Phễu tuyển dụng' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('Mới');
    expect(within(items[0]).getByRole('img')).toHaveAccessibleName(
      'Mới: 40 hồ sơ, 100% so với bậc đầu',
    );
    expect(within(items[2]).getByRole('img')).toHaveAccessibleName(
      'Phỏng vấn: 10 hồ sơ, 25% so với bậc đầu',
    );
    expect(screen.getByText('Bị từ chối').nextElementSibling).toHaveTextContent(
      '9',
    );
    expect(
      screen.getByText('Ứng viên rút').nextElementSibling,
    ).toHaveTextContent('2');
  });

  it('offers the same figures as a table', async () => {
    const user = renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Xem dạng bảng' }),
    );
    const table = screen.getByRole('table', { name: 'Phễu tuyển dụng' });
    expect(
      within(table).getByRole('row', { name: /Đề nghị 4 10%/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem dạng biểu đồ' }));
    expect(
      screen.getByRole('list', { name: 'Phễu tuyển dụng' }),
    ).toBeInTheDocument();
  });

  it('says so when nothing reached any stage', async () => {
    renderPage(UserRole.HR_MANAGER, {
      ...overview,
      funnel: overview.funnel.map((item) => ({ ...item, count: 0 })),
    });
    expect(
      await screen.findByText('Chưa có hồ sơ nào trong kỳ này.'),
    ).toBeInTheDocument();
  });

  it('links each to-do to the list the API says', async () => {
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'Hồ sơ chưa phân công' }),
    ).toHaveAttribute('href', '/applications?status=NEW');
    expect(
      screen.getByRole('link', { name: 'Yêu cầu chờ duyệt' }),
    ).toHaveAttribute('href', '/requisitions?status=PENDING_APPROVAL');
  });

  it('never links an address that leaves the app', async () => {
    renderPage(UserRole.HR_MANAGER, {
      ...overview,
      todo: [{ type: 'X', label: 'Việc lạ', count: 1, href: '//evil.test/x' }],
    });
    await screen.findByText('Việc lạ');
    expect(
      screen.queryByRole('link', { name: 'Việc lạ' }),
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when there is nothing to do', async () => {
    renderPage(UserRole.HR_MANAGER, { ...overview, todo: [] });
    expect(
      await screen.findByText('Không có việc cần xử lý.'),
    ).toBeInTheDocument();
  });

  it('gives HR a department filter and a department manager none', async () => {
    renderPage(UserRole.HR_MANAGER);
    await screen.findByText('Hồ sơ mới');
    expect(
      screen.getByRole('combobox', { name: 'Lọc theo phòng ban' }),
    ).toBeInTheDocument();
  });

  it('hides the department filter from a department manager', async () => {
    renderPage(UserRole.DEPT_MANAGER);
    await screen.findByText('Hồ sơ mới');
    expect(
      screen.queryByRole('combobox', { name: 'Lọc theo phòng ban' }),
    ).not.toBeInTheDocument();
  });

  it('sends the period and department from the address', async () => {
    currentQuery =
      'from=2026-10-01&to=2026-10-31&departmentId=7c9e6679-7425-40de-944b-e07fc1f90ae7';
    renderPage();
    await screen.findByText('Hồ sơ mới');
    expect(fetchOverview).toHaveBeenCalledWith(
      {
        from: '2026-10-01',
        to: '2026-10-31',
        departmentId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      },
      expect.anything(),
    );
  });

  it('shows a refused period in place and not as a page error', async () => {
    role = UserRole.HR_MANAGER;
    vi.mocked(fetchOverview).mockRejectedValue(
      new ApiError(400, ['Khoảng thời gian tối đa là 366 ngày']),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <DashboardPage />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText('Khoảng thời gian tối đa là 366 ngày'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Từ ngày')).toBeInTheDocument();
  });

  it('shows no access to a role without the overview', () => {
    renderPage(UserRole.INTERVIEWER);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(fetchOverview).not.toHaveBeenCalled();
  });
});
