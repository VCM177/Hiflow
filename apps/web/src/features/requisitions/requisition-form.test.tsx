import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserRole } from '@hiflow/shared-types';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import {
  createRequisition,
  submitRequisition,
  updateRequisition,
  type Requisition,
} from './requisition-api';
import { RequisitionForm } from './requisition-form';

const push = vi.fn();
let role: UserRole = UserRole.DEPT_MANAGER;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ user: { role }, can: () => true }),
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
vi.mock('./requisition-api', () => ({
  createRequisition: vi.fn(),
  updateRequisition: vi.fn(),
  submitRequisition: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const saved = { id: 'r9' } as Requisition;

function renderForm(requisition: Requisition | null = null) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <RequisitionForm requisition={requisition} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Tiêu đề/), 'Tuyển kế toán');
  await user.click(screen.getByRole('combobox', { name: /Vị trí/ }));
  await user.click(await screen.findByRole('option', { name: 'Kế toán' }));
  await user.type(screen.getByLabelText(/^Số lượng/), '2');
}

beforeEach(() => {
  vi.clearAllMocks();
  role = UserRole.DEPT_MANAGER;
  vi.mocked(createRequisition).mockResolvedValue(saved);
  vi.mocked(updateRequisition).mockResolvedValue(saved);
  vi.mocked(submitRequisition).mockResolvedValue(saved);
});

describe('RequisitionForm', () => {
  it('hides the department from a department manager and does not send it', async () => {
    const user = renderForm();
    expect(
      screen.queryByRole('combobox', { name: /Phòng ban/ }),
    ).not.toBeInTheDocument();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(createRequisition).toHaveBeenCalled());
    expect(createRequisition).toHaveBeenCalledWith({
      title: 'Tuyển kế toán',
      positionId: 'p1',
      quantity: 2,
      reason: undefined,
      expectedStartDate: undefined,
      budgetMin: undefined,
      budgetMax: undefined,
    });
    expect(submitRequisition).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/requisitions/r9'));
  });

  it('asks HR for the department and sends it', async () => {
    role = UserRole.HR_MANAGER;
    const user = renderForm();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(
      await screen.findByText('Vui lòng chọn phòng ban.'),
    ).toBeInTheDocument();
    expect(createRequisition).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: /Phòng ban/ }));
    await user.click(await screen.findByRole('option', { name: 'Tài chính' }));
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() =>
      expect(createRequisition).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: 'd1' }),
      ),
    );
  });

  it('saves and sends for approval', async () => {
    const user = renderForm();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Lưu và gửi duyệt' }));
    await waitFor(() => expect(submitRequisition).toHaveBeenCalledWith('r9'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/requisitions/r9'));
  });

  it('still opens the saved record when only the sending failed', async () => {
    vi.mocked(submitRequisition).mockRejectedValue(
      new ApiError(409, ['Không thể gửi']),
    );
    const user = renderForm();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Lưu và gửi duyệt' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/requisitions/r9'));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Đã lưu nháp nhưng chưa gửi duyệt được'),
    );
  });

  it('stays on the form and keeps the input when saving fails', async () => {
    vi.mocked(createRequisition).mockRejectedValue(
      new ApiError(400, ['Vị trí tuyển dụng không tồn tại']),
    );
    const user = renderForm();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Vị trí tuyển dụng không tồn tại',
      ),
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Tiêu đề/)).toHaveValue('Tuyển kế toán');
  });

  it('blocks a maximum budget below the minimum before sending', async () => {
    const user = renderForm();
    await fill(user);
    await user.type(screen.getByLabelText('Tối thiểu'), '20000000');
    await user.type(screen.getByLabelText('Tối đa'), '10000000');
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(
      await screen.findByText(/Ngân sách tối đa không được nhỏ hơn/),
    ).toBeInTheDocument();
    expect(createRequisition).not.toHaveBeenCalled();
  });

  it('edits with the record loaded and clears blank optional fields with null', async () => {
    const existing = {
      ...saved,
      id: 'r1',
      code: 'REQ-1',
      title: 'Cũ',
      department: { id: 'd1', name: 'Tài chính' },
      position: { id: 'p1', name: 'Kế toán' },
      quantity: 3,
      reason: 'Lý do cũ',
      expectedStartDate: null,
      budgetMin: null,
      budgetMax: null,
    } as Requisition;
    const user = renderForm(existing);
    expect(screen.getByLabelText(/^Tiêu đề/)).toHaveValue('Cũ');
    await user.clear(screen.getByLabelText(/^Lý do tuyển dụng/));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateRequisition).toHaveBeenCalled());
    expect(updateRequisition).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ reason: null, quantity: 3 }),
    );
  });
});
