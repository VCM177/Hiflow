import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ROLE_PERMISSIONS,
  ReportType,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import { exportReport, fetchReport, type ReportData } from './report-api';
import { ReportsPage } from './reports-page';

const push = vi.fn();
let role: UserRole = UserRole.HR_MANAGER;
let currentQuery = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/reports/job-results',
  useSearchParams: () => new URLSearchParams(currentQuery),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => {
    const granted = ROLE_PERMISSIONS[role] as readonly Permission[];
    return {
      user: { id: 'me', role, permissions: granted },
      can: (p: Permission) => can(granted, p),
    };
  },
}));
vi.mock('@/features/catalogs/options', () => ({
  useDepartmentOptions: () => ({
    options: [{ value: 'd1', label: 'Tài chính' }],
    isLoading: false,
  }),
  usePositionOptions: () => ({
    options: [{ value: 'p1', label: 'Kế toán' }],
    isLoading: false,
  }),
}));
vi.mock('./report-api', () => ({
  fetchReport: vi.fn(),
  exportReport: vi.fn(),
}));

const report: ReportData = {
  type: ReportType.JOB_RESULTS,
  title: 'Kết quả theo tin',
  period: { from: '2026-10-08', to: '2026-11-06' },
  columns: [
    { key: 'job', label: 'Tin' },
    { key: 'applications', label: 'Số hồ sơ' },
    { key: 'hired', label: 'Nhận việc' },
  ],
  rows: [
    { job: 'Kế toán tổng hợp', applications: 12, hired: 1 },
    { job: 'Lập trình viên', applications: 30, hired: 2 },
  ],
};

function renderPage(
  type: ReportType = ReportType.JOB_RESULTS,
  as: UserRole = UserRole.HR_MANAGER,
) {
  role = as;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ReportsPage type={type} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = '';
  vi.mocked(fetchReport).mockResolvedValue(report);
});

describe('ReportsPage', () => {
  it('draws the columns and rows the API describes, figures on the right', async () => {
    renderPage();
    // The table is there while loading; wait for its rows.
    await screen.findByRole('row', { name: /Lập trình viên/ });
    const table = screen.getByRole('table', { name: 'Kết quả theo tin' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Tin', 'Số hồ sơ', 'Nhận việc']);
    const row = within(table).getByRole('row', { name: /Lập trình viên/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Lập trình viên', '30', '2']);
    expect(
      screen.getByText(/Kỳ 08\/10\/2026 – 06\/11\/2026/),
    ).toBeInTheDocument();
  });

  it('has a tab per report and moves between them keeping the filters', async () => {
    currentQuery = 'from=2026-10-01';
    window.history.replaceState(
      null,
      '',
      '/reports/job-results?from=2026-10-01',
    );
    const user = renderPage();
    await screen.findByRole('table');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Tiến độ yêu cầu',
      'Kết quả theo tin',
      'Nguồn ứng viên',
    ]);
    await user.click(screen.getByRole('tab', { name: 'Nguồn ứng viên' }));
    expect(push).toHaveBeenCalledWith(
      '/reports/candidate-sources?from=2026-10-01',
    );
  });

  it('sends the period, department and position from the address', async () => {
    currentQuery =
      'from=2026-10-01&to=2026-10-31&departmentId=7c9e6679-7425-40de-944b-e07fc1f90ae7&positionId=550e8400-e29b-41d4-a716-446655440000';
    renderPage();
    await screen.findByRole('table');
    expect(fetchReport).toHaveBeenCalledWith(
      ReportType.JOB_RESULTS,
      {
        from: '2026-10-01',
        to: '2026-10-31',
        departmentId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        positionId: '550e8400-e29b-41d4-a716-446655440000',
      },
      expect.anything(),
    );
  });

  it('exports the CSV, tells the person the file name, and notes that it is audited', async () => {
    vi.mocked(exportReport).mockResolvedValue('ket-qua-theo-tin.csv');
    const user = renderPage();
    await screen.findByRole('table');
    expect(screen.getByText(/ghi vào nhật ký kiểm toán/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
    await waitFor(() =>
      expect(exportReport).toHaveBeenCalledWith(
        ReportType.JOB_RESULTS,
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã tải ket-qua-theo-tin.csv'),
    );
  });

  it('reports a failed export and leaves the button usable', async () => {
    vi.mocked(exportReport).mockRejectedValue(new ApiError(403, []));
    const user = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Xuất CSV' })).toBeEnabled();
  });

  it('shows a refused period in place, keeping the filters', async () => {
    vi.mocked(fetchReport).mockRejectedValue(
      new ApiError(400, ['Khoảng thời gian tối đa là 366 ngày']),
    );
    renderPage();
    expect(
      await screen.findByText('Khoảng thời gian tối đa là 366 ngày'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Từ ngày')).toBeInTheDocument();
  });

  it('says so when a report has no rows', async () => {
    vi.mocked(fetchReport).mockResolvedValue({ ...report, rows: [] });
    renderPage();
    expect(await screen.findByText('Không có số liệu')).toBeInTheDocument();
  });

  it.each([UserRole.RECRUITER, UserRole.DEPT_MANAGER, UserRole.INTERVIEWER])(
    'shows no access to %s',
    (as) => {
      renderPage(ReportType.JOB_RESULTS, as);
      expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
      expect(fetchReport).not.toHaveBeenCalled();
    },
  );
});
