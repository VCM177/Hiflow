import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import {
  exportAuditEvents,
  fetchAuditEvents,
  type AuditEventRow,
} from './audit-api';
import { AuditPage } from './audit-page';

let role: UserRole = UserRole.ADMIN;
let currentQuery = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/audit-events',
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
vi.mock('@/features/users/user-api', () => ({
  fetchUsers: vi.fn().mockResolvedValue({
    items: [
      { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', fullName: 'Nguyễn Văn An' },
    ],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  }),
}));
vi.mock('./audit-api', () => ({
  fetchAuditEvents: vi.fn(),
  exportAuditEvents: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const row: AuditEventRow = {
  id: 'e1',
  occurredAt: '2026-11-06T03:15:00.000Z',
  event: 'JOB_PUBLISHED',
  label: 'Đăng tin tuyển dụng',
  entityType: 'Job',
  entityId: 'j1',
  actor: { id: 'u1', name: 'Phạm Minh Tuấn', role: 'RECRUITER' },
  txId: 't1',
  requestId: null,
  origin: 'app',
  ip: null,
  userAgent: null,
  data: {},
};

function renderPage(as: UserRole = UserRole.ADMIN) {
  role = as;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AuditPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = '';
  vi.mocked(fetchAuditEvents).mockResolvedValue({
    items: [row],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  });
});

describe('AuditPage', () => {
  it('lists time in Vietnam time, the Vietnamese label, the actor as they were, the target and the source', async () => {
    renderPage();
    const line = (await screen.findByText('Đăng tin tuyển dụng')).closest(
      'tr',
    )!;
    expect(within(line).getByText(/06\/11\/2026 10:15/)).toBeInTheDocument();
    expect(within(line).getByText(/Phạm Minh Tuấn/)).toBeInTheDocument();
    expect(within(line).getByText(/Tuyển dụng/)).toBeInTheDocument();
    expect(within(line).getByText('Job')).toBeInTheDocument();
    expect(within(line).getByText('Ứng dụng')).toBeInTheDocument();
    expect(within(line).getByRole('link')).toHaveAttribute(
      'href',
      '/audit-events/e1',
    );
  });

  it('asks for the newest first, and names a visitor "Khách"', async () => {
    vi.mocked(fetchAuditEvents).mockResolvedValue({
      items: [{ ...row, actor: { id: null, name: null, role: null } }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    renderPage();
    await screen.findByText('Khách');
    expect(fetchAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ sortDir: 'desc' }),
      expect.anything(),
    );
  });

  it('sends every filter from the address, and drops values the API would refuse', async () => {
    currentQuery =
      'event=JOB_PUBLISHED&entityType=Job&origin=app&actorId=7c9e6679-7425-40de-944b-e07fc1f90ae7&from=2026-11-01&to=2026-11-06&search=Tuấn';
    renderPage();
    await screen.findByText('Đăng tin tuyển dụng');
    expect(fetchAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'JOB_PUBLISHED',
        entityType: 'Job',
        origin: 'app',
        actorId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        from: '2026-11-01',
        to: '2026-11-06',
        search: 'Tuấn',
      }),
      expect.anything(),
    );
  });

  it('ignores an unknown event or source in the address', async () => {
    currentQuery = 'event=NOPE&origin=mars&actorId=not-an-id';
    renderPage();
    await screen.findByText('Đăng tin tuyển dụng');
    expect(fetchAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        event: undefined,
        origin: undefined,
        actorId: undefined,
      }),
      expect.anything(),
    );
  });

  it('offers the events by their Vietnamese labels', async () => {
    const user = renderPage();
    await screen.findByText('Đăng tin tuyển dụng');
    await user.click(
      screen.getByRole('combobox', { name: 'Lọc theo sự kiện' }),
    );
    expect(
      await screen.findByRole('option', { name: 'Xếp lịch phỏng vấn' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'INTERVIEW_SCHEDULED' }),
    ).not.toBeInTheDocument();
  });

  it('warns about personal data and the export limit, and exports with the current filters', async () => {
    currentQuery = 'origin=app';
    vi.mocked(exportAuditEvents).mockResolvedValue('nhat-ky.csv');
    const user = renderPage();
    await screen.findByText('Đăng tin tuyển dụng');
    expect(
      screen.getByText(/chứa dữ liệu cá nhân, chỉ Admin được đọc/),
    ).toBeInTheDocument();
    expect(screen.getByText(/tối đa 10\.000 dòng/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
    await waitFor(() =>
      expect(exportAuditEvents).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'app' }),
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Đã tải nhat-ky.csv'),
    );
  });

  it('reports a refused export', async () => {
    vi.mocked(exportAuditEvents).mockRejectedValue(new ApiError(403, []));
    const user = renderPage();
    await screen.findByText('Đăng tin tuyển dụng');
    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it.each([
    UserRole.HR_MANAGER,
    UserRole.RECRUITER,
    UserRole.DEPT_MANAGER,
    UserRole.INTERVIEWER,
  ])('shows no access to %s', (as) => {
    renderPage(as);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(fetchAuditEvents).not.toHaveBeenCalled();
  });
});
