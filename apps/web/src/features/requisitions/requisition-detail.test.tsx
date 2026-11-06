import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ROLE_PERMISSIONS,
  RequisitionStatus,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import {
  approveRequisition,
  closeRequisition,
  fetchRequisition,
  fetchRequisitionHistory,
  rejectRequisition,
  type Requisition,
} from './requisition-api';
import { RequisitionDetail } from './requisition-detail';

let role: UserRole = UserRole.HR_MANAGER;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => {
    const granted = ROLE_PERMISSIONS[role] as readonly Permission[];
    return {
      user: { role, permissions: granted },
      can: (p: Permission) => can(granted, p),
    };
  },
}));
vi.mock('@/features/jobs/job-api', () => ({
  fetchJobs: vi.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 50, total: 0, totalPages: 1 },
  }),
}));
vi.mock('./requisition-api', () => ({
  fetchRequisition: vi.fn(),
  fetchRequisitionHistory: vi.fn(),
  deleteRequisition: vi.fn(),
  submitRequisition: vi.fn(),
  approveRequisition: vi.fn(),
  rejectRequisition: vi.fn(),
  closeRequisition: vi.fn(),
}));

const base: Requisition = {
  id: 'r1',
  code: 'REQ-2026-0001',
  title: 'Tuyển kế toán',
  department: { id: 'd1', name: 'Tài chính' },
  position: { id: 'p1', name: 'Kế toán' },
  quantity: 2,
  reason: 'Mở rộng',
  expectedStartDate: null,
  budgetMin: null,
  budgetMax: null,
  status: RequisitionStatus.DRAFT,
  createdBy: { id: 'u1', name: 'Trưởng phòng' },
  approvedBy: null,
  approvedAt: null,
  rejectReason: null,
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
};

function renderDetail(over: Partial<Requisition>, as: UserRole) {
  role = as;
  vi.mocked(fetchRequisition).mockResolvedValue({ ...base, ...over });
  vi.mocked(fetchRequisitionHistory).mockResolvedValue([
    {
      id: 'e1',
      event: 'CREATED',
      actor: { id: 'u1', name: 'Trưởng phòng' },
      note: null,
      at: '2026-11-01T03:00:00.000Z',
    },
    {
      id: 'e2',
      event: 'REJECTED',
      actor: { id: 'h', name: 'HR' },
      note: 'Thiếu ngân sách',
      at: '2026-11-02T03:00:00.000Z',
    },
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RequisitionDetail id="r1" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const names = () =>
  screen
    .queryAllByRole('button')
    .concat(screen.queryAllByRole('link'))
    .map((el) => el.textContent?.trim());

beforeEach(() => vi.clearAllMocks());

describe('RequisitionDetail actions', () => {
  it('offers a manager edit, delete and submit on a draft', async () => {
    renderDetail({}, UserRole.DEPT_MANAGER);
    await screen.findByText('Tuyển kế toán', { exact: false });
    expect(names()).toEqual(
      expect.arrayContaining(['Sửa', 'Xóa', 'Gửi duyệt']),
    );
    expect(names()).not.toContain('Duyệt yêu cầu');
  });

  it('offers HR approve and reject while pending, and nothing to a manager', async () => {
    renderDetail(
      { status: RequisitionStatus.PENDING_APPROVAL },
      UserRole.HR_MANAGER,
    );
    await screen.findByText('Chờ duyệt');
    expect(names()).toEqual(
      expect.arrayContaining(['Duyệt yêu cầu', 'Từ chối']),
    );
  });

  it('offers a manager no action while pending', async () => {
    renderDetail(
      { status: RequisitionStatus.PENDING_APPROVAL },
      UserRole.DEPT_MANAGER,
    );
    await screen.findByText('Chờ duyệt');
    expect(names()).not.toContain('Duyệt yêu cầu');
    expect(names()).not.toContain('Từ chối');
  });

  it('offers HR the close action once approved (the job link is for recruiters)', async () => {
    renderDetail({ status: RequisitionStatus.APPROVED }, UserRole.HR_MANAGER);
    await screen.findByText('Đã duyệt');
    expect(names()).toContain('Đóng yêu cầu');
  });

  it('offers no action on a closed requisition', async () => {
    renderDetail({ status: RequisitionStatus.CLOSED }, UserRole.ADMIN);
    await screen.findByText('Đã đóng');
    expect(names()).not.toContain('Đóng yêu cầu');
    expect(names()).not.toContain('Sửa');
  });
});

describe('RequisitionDetail', () => {
  it('shows the reject reason prominently and "Gửi duyệt lại"', async () => {
    renderDetail(
      { status: RequisitionStatus.REJECTED, rejectReason: 'Thiếu ngân sách' },
      UserRole.DEPT_MANAGER,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Yêu cầu bị từ chối');
    expect(alert).toHaveTextContent('Thiếu ngân sách');
    expect(names()).toContain('Gửi duyệt lại');
  });

  it('lists the history newest first, in words', async () => {
    renderDetail({}, UserRole.HR_MANAGER);
    const list = await screen.findByRole('list', { name: 'Lịch sử yêu cầu' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Từ chối yêu cầu');
    expect(items[1]).toHaveTextContent('Tạo yêu cầu');
  });

  it('needs a reason to reject', async () => {
    const user = renderDetail(
      { status: RequisitionStatus.PENDING_APPROVAL },
      UserRole.HR_MANAGER,
    );
    vi.mocked(rejectRequisition).mockResolvedValue(base);
    await user.click(await screen.findByRole('button', { name: 'Từ chối' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Từ chối yêu cầu',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Từ chối yêu cầu' }),
    );
    expect(rejectRequisition).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole('textbox'), 'Chưa rõ ngân sách');
    await user.click(
      within(dialog).getByRole('button', { name: 'Từ chối yêu cầu' }),
    );
    await waitFor(() =>
      expect(rejectRequisition).toHaveBeenCalledWith('r1', 'Chưa rõ ngân sách'),
    );
  });

  it('approves after confirmation', async () => {
    const user = renderDetail(
      { status: RequisitionStatus.PENDING_APPROVAL },
      UserRole.HR_MANAGER,
    );
    vi.mocked(approveRequisition).mockResolvedValue(base);
    await user.click(
      await screen.findByRole('button', { name: 'Duyệt yêu cầu' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Duyệt yêu cầu' });
    await user.click(
      within(dialog).getByRole('button', { name: 'Duyệt yêu cầu' }),
    );
    await waitFor(() => expect(approveRequisition).toHaveBeenCalledWith('r1'));
  });

  it('says closing also closes the jobs, and shows a 409 with a reload button', async () => {
    const user = renderDetail(
      { status: RequisitionStatus.APPROVED },
      UserRole.HR_MANAGER,
    );
    vi.mocked(closeRequisition).mockRejectedValue(
      new ApiError(409, [
        'Yêu cầu vừa được xử lý bởi người khác, vui lòng tải lại',
      ]),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Đóng yêu cầu' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Đóng yêu cầu' });
    expect(dialog).toHaveTextContent('tự động đóng');
    await user.click(
      within(dialog).getByRole('button', { name: 'Đóng yêu cầu' }),
    );
    expect(
      await within(dialog).findByText(/xử lý bởi người khác/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Tải lại' }),
    ).toBeInTheDocument();
  });

  it('shows the not-found page for a record out of scope', async () => {
    role = UserRole.DEPT_MANAGER;
    vi.mocked(fetchRequisition).mockRejectedValue(new ApiError(404, []));
    vi.mocked(fetchRequisitionHistory).mockRejectedValue(new ApiError(404, []));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RequisitionDetail id="r1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
  });
});
