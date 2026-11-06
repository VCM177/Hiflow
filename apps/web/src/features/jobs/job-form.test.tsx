import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { createJob, updateJob, type Job } from './job-api';
import { JobForm, type RequisitionChoice } from './job-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Tiptap is covered by the browser spec; here the description is a plain box.
vi.mock('./description-field', () => ({
  DescriptionField: ({
    control,
    name,
  }: {
    control: { _formValues: Record<string, string> };
    name: string;
  }) => (
    <label>
      Mô tả công việc
      <textarea defaultValue={control._formValues[name]} readOnly />
    </label>
  ),
}));
vi.mock('./job-api', () => ({ createJob: vi.fn(), updateJob: vi.fn() }));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const A: RequisitionChoice = {
  id: 'r1',
  title: 'Kế toán',
  quantity: 2,
  label: 'REQ-1 · Kế toán',
};
const B: RequisitionChoice = {
  id: 'r2',
  title: 'Lập trình viên',
  quantity: 5,
  label: 'REQ-2 · Lập trình viên',
};

function renderForm(props: Partial<React.ComponentProps<typeof JobForm>> = {}) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <JobForm job={null} requisitions={[A, B]} preselected={null} {...props} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createJob).mockResolvedValue({ id: 'j1' } as Job);
  vi.mocked(updateJob).mockResolvedValue({ id: 'j1' } as Job);
});

describe('JobForm', () => {
  it('starts from the requisition in the address', () => {
    renderForm({ preselected: A });
    expect(screen.getByLabelText(/^Tiêu đề/)).toHaveValue('Kế toán');
    expect(screen.getByLabelText(/^Số lượng/)).toHaveValue('2');
    expect(
      screen.getByRole('combobox', { name: /Yêu cầu tuyển dụng/ }),
    ).toHaveTextContent('REQ-1');
  });

  it('refills title and headcount when another requisition is picked, unless typed over', async () => {
    const user = renderForm({ preselected: A });
    await user.click(
      screen.getByRole('combobox', { name: /Yêu cầu tuyển dụng/ }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'REQ-2 · Lập trình viên' }),
    );
    expect(screen.getByLabelText(/^Tiêu đề/)).toHaveValue('Lập trình viên');
    expect(screen.getByLabelText(/^Số lượng/)).toHaveValue('5');

    await user.clear(screen.getByLabelText(/^Tiêu đề/));
    await user.type(screen.getByLabelText(/^Tiêu đề/), 'Tên riêng');
    await user.click(
      screen.getByRole('combobox', { name: /Yêu cầu tuyển dụng/ }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'REQ-1 · Kế toán' }),
    );
    expect(screen.getByLabelText(/^Tiêu đề/)).toHaveValue('Tên riêng');
    expect(screen.getByLabelText(/^Số lượng/)).toHaveValue('2');
  });

  it('creates the job from the requisition and opens it', async () => {
    const user = renderForm({ preselected: A });
    await user.type(screen.getByLabelText(/^Lương tối thiểu/), '10000000');
    await user.click(screen.getByRole('button', { name: 'Tạo tin' }));
    await waitFor(() => expect(createJob).toHaveBeenCalled());
    expect(createJob).toHaveBeenCalledWith({
      requisitionId: 'r1',
      title: 'Kế toán',
      quantity: 2,
      salaryMin: 10_000_000,
      salaryMax: undefined,
      location: undefined,
      description: undefined,
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/jobs/j1'));
  });

  it('puts the approved-headcount 409 on the quantity box', async () => {
    vi.mocked(createJob).mockRejectedValue(
      new ApiError(409, ['Vượt quá số lượng đã duyệt của yêu cầu (còn lại 1)']),
    );
    const user = renderForm({ preselected: A });
    await user.click(screen.getByRole('button', { name: 'Tạo tin' }));
    expect(
      await screen.findByText(/Vượt quá số lượng đã duyệt/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Số lượng/)).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  it('refuses a maximum salary below the minimum', async () => {
    const user = renderForm({ preselected: A });
    await user.type(screen.getByLabelText(/^Lương tối thiểu/), '20000000');
    await user.type(screen.getByLabelText(/^Lương tối đa/), '10000000');
    await user.click(screen.getByRole('button', { name: 'Tạo tin' }));
    expect(
      await screen.findByText(/Lương tối đa không được nhỏ hơn/),
    ).toBeInTheDocument();
    expect(createJob).not.toHaveBeenCalled();
  });

  it('needs a requisition', async () => {
    const user = renderForm();
    await user.click(screen.getByRole('button', { name: 'Tạo tin' }));
    expect(
      await screen.findByText('Vui lòng chọn yêu cầu tuyển dụng.'),
    ).toBeInTheDocument();
  });

  it('edits an existing job without choosing the requisition and nulls cleared fields', async () => {
    const job = {
      id: 'j1',
      requisition: { id: 'r1', code: 'REQ-1' },
      title: 'Kế toán',
      quantity: 2,
      salaryMin: 5_000_000,
      salaryMax: null,
      location: 'Hà Nội',
      description: '<p>Cũ</p>',
    } as Job;
    const user = renderForm({ job, requisitions: [] });
    expect(
      screen.queryByRole('combobox', { name: /Yêu cầu tuyển dụng/ }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Lương tối thiểu/));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateJob).toHaveBeenCalled());
    expect(updateJob).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({ salaryMin: null, location: 'Hà Nội' }),
    );
  });

  it('shows other API errors as a toast', async () => {
    vi.mocked(createJob).mockRejectedValue(
      new ApiError(409, ['Chỉ tạo tin từ yêu cầu đã được duyệt']),
    );
    const user = renderForm({ preselected: A });
    await user.click(screen.getByRole('button', { name: 'Tạo tin' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Chỉ tạo tin từ yêu cầu đã được duyệt',
      ),
    );
  });
});
