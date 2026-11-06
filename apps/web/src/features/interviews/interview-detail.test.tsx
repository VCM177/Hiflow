import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  InterviewResult,
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import {
  cancelInterview,
  fetchInterview,
  recordInterviewResult,
  updateInterview,
  type Interview,
} from './interview-api';
import { InterviewDetail } from './interview-detail';

let role: UserRole = UserRole.INTERVIEWER;
let wide = true;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => wide }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => {
    const granted = ROLE_PERMISSIONS[role] as readonly Permission[];
    return {
      user: { id: 'me', role },
      can: (p: Permission) => can(granted, p),
    };
  },
}));
vi.mock('@/features/users/options', () => ({
  useUserOptions: () => ({
    options: [{ value: 'u1', label: 'Phỏng vấn viên A' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/applications/application-api', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/applications/application-api')
  >()),
  fetchApplication: vi.fn().mockResolvedValue({
    id: 'a1',
    status: 'INTERVIEW',
    job: { id: 'j1', title: 'Kế toán', status: 'OPEN' },
    candidate: { id: 'c1', fullName: 'Nguyễn Văn An', email: 'an@example.com' },
    candidateDetail: { phone: '0901234567', hasCv: true },
    hasCv: true,
  }),
}));
vi.mock('@/features/jobs/job-api', () => ({
  fetchJob: vi
    .fn()
    .mockResolvedValue({ id: 'j1', description: '<p>Mô tả tin</p>' }),
}));
vi.mock('./interview-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./interview-api')>()),
  fetchInterview: vi.fn(),
  updateInterview: vi.fn(),
  cancelInterview: vi.fn(),
  recordInterviewResult: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const base: Interview = {
  id: 'i1',
  application: {
    id: 'a1',
    candidate: { id: 'c1', fullName: 'Nguyễn Văn An' },
    job: { id: 'j1', title: 'Kế toán' },
  },
  round: 1,
  scheduledAt: '2030-11-03T02:00:00.000Z',
  interviewer: { id: 'me', name: 'Tôi' },
  result: InterviewResult.PENDING,
  feedback: null,
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
};

function renderDetail(
  over: Partial<Interview> = {},
  as: UserRole = UserRole.INTERVIEWER,
) {
  role = as;
  vi.mocked(fetchInterview).mockResolvedValue({ ...base, ...over });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <InterviewDetail id="i1" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const buttons = () =>
  screen.queryAllByRole('button').map((el) => el.textContent?.trim());

beforeEach(() => {
  vi.clearAllMocks();
  wide = true;
});

describe('InterviewDetail result', () => {
  it('gives the assigned interviewer the form, with the CV and the job beside it', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: /Nguyễn Văn An · Vòng 1/ });
    expect(
      screen.getByRole('combobox', { name: /Kết quả/ }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Tải CV/ })).toHaveAttribute(
      'href',
      '/api/applications/a1/cv',
    );
    expect(screen.getByText('0901234567')).toBeInTheDocument();
  });

  it('needs a comment for Không đạt, then confirms before sending', async () => {
    vi.mocked(recordInterviewResult).mockResolvedValue(base);
    const user = renderDetail();
    await user.click(await screen.findByRole('combobox', { name: /Kết quả/ }));
    await user.click(await screen.findByRole('option', { name: 'Không đạt' }));
    await user.click(screen.getByRole('button', { name: 'Ghi kết quả' }));
    expect(
      await screen.findByText('Vui lòng nhập nhận xét khi không đạt.'),
    ).toBeInTheDocument();
    expect(recordInterviewResult).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Nhận xét/), 'Thiếu kinh nghiệm');
    await user.click(screen.getByRole('button', { name: 'Ghi kết quả' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ghi kết quả phỏng vấn',
    });
    expect(dialog).toHaveTextContent('không thể thay đổi');
    await user.click(
      within(dialog).getByRole('button', { name: 'Ghi kết quả' }),
    );
    await waitFor(() =>
      expect(recordInterviewResult).toHaveBeenCalledWith('i1', {
        result: 'FAILED',
        feedback: 'Thiếu kinh nghiệm',
      }),
    );
  });

  it('lets a pass go without a comment', async () => {
    vi.mocked(recordInterviewResult).mockResolvedValue(base);
    const user = renderDetail();
    await user.click(await screen.findByRole('combobox', { name: /Kết quả/ }));
    await user.click(await screen.findByRole('option', { name: 'Đạt' }));
    await user.click(screen.getByRole('button', { name: 'Ghi kết quả' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ghi kết quả phỏng vấn',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Ghi kết quả' }),
    );
    await waitFor(() =>
      expect(recordInterviewResult).toHaveBeenCalledWith('i1', {
        result: 'PASSED',
      }),
    );
  });

  it('shows the API refusal in the dialog when someone else decided first', async () => {
    vi.mocked(recordInterviewResult).mockRejectedValue(
      new ApiError(409, [
        'Lịch phỏng vấn vừa được xử lý bởi người khác, vui lòng tải lại',
      ]),
    );
    const user = renderDetail();
    await user.click(await screen.findByRole('combobox', { name: /Kết quả/ }));
    await user.click(await screen.findByRole('option', { name: 'Đạt' }));
    await user.click(screen.getByRole('button', { name: 'Ghi kết quả' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ghi kết quả phỏng vấn',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Ghi kết quả' }),
    );
    expect(
      await within(dialog).findByText(/xử lý bởi người khác/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Tải lại' }),
    ).toBeInTheDocument();
  });

  it('gives HR no form on someone else’s interview, only the explanation', async () => {
    renderDetail(
      { interviewer: { id: 'other', name: 'Người khác' } },
      UserRole.HR_MANAGER,
    );
    await screen.findByRole('heading', { name: /Nguyễn Văn An/ });
    expect(
      screen.queryByRole('combobox', { name: /Kết quả/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Chỉ người được xếp lịch/)).toBeInTheDocument();
  });

  it('gives HR the form on their own interview', async () => {
    renderDetail({}, UserRole.HR_MANAGER);
    expect(
      await screen.findByRole('combobox', { name: /Kết quả/ }),
    ).toBeInTheDocument();
  });

  it('gives the Admin the form on anyone’s interview', async () => {
    renderDetail(
      { interviewer: { id: 'other', name: 'Người khác' } },
      UserRole.ADMIN,
    );
    expect(
      await screen.findByRole('combobox', { name: /Kết quả/ }),
    ).toBeInTheDocument();
  });

  it('shows a recorded result read only, with the comment', async () => {
    renderDetail({
      result: InterviewResult.FAILED,
      feedback: 'Thiếu kinh nghiệm',
    });
    await screen.findByRole('heading', { name: /Nguyễn Văn An/ });
    expect(
      screen.queryByRole('combobox', { name: /Kết quả/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Thiếu kinh nghiệm')).toBeInTheDocument();
    expect(buttons().join()).not.toMatch(/Sửa lịch|Hủy lịch/);
  });
});

describe('InterviewDetail schedule actions', () => {
  it('offers the recruiter edit and cancel while pending, and not the interviewer', async () => {
    renderDetail({}, UserRole.RECRUITER);
    await screen.findByRole('heading', { name: /Nguyễn Văn An/ });
    expect(buttons()).toEqual(expect.arrayContaining(['Sửa lịch', 'Hủy lịch']));
  });

  it('offers the interviewer neither', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: /Nguyễn Văn An/ });
    expect(buttons().join()).not.toMatch(/Sửa lịch|Hủy lịch/);
  });

  it('cancels after confirmation', async () => {
    vi.mocked(cancelInterview).mockResolvedValue(base);
    const user = renderDetail({}, UserRole.RECRUITER);
    await user.click(await screen.findByRole('button', { name: 'Hủy lịch' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Hủy lịch phỏng vấn',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Hủy lịch' }));
    await waitFor(() => expect(cancelInterview).toHaveBeenCalledWith('i1'));
  });

  it('shows a clash with the interviewer’s other interview inside the edit dialog', async () => {
    vi.mocked(updateInterview).mockRejectedValue(
      new ApiError(409, ['Người phỏng vấn đã có lịch trong khung giờ này']),
    );
    const user = renderDetail({}, UserRole.RECRUITER);
    await user.click(await screen.findByRole('button', { name: 'Sửa lịch' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Sửa lịch phỏng vấn',
    });
    // opens on the current time, in Vietnam time (2030-11-03 02:00 UTC = 09:00)
    expect(within(dialog).getByLabelText(/^Ngày giờ/)).toHaveValue(
      '2030-11-03T09:00',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );
    expect(
      await within(dialog).findByText(/đã có lịch trong khung giờ này/),
    ).toBeInTheDocument();
  });

  it('sends the change with the +07:00 offset', async () => {
    vi.mocked(updateInterview).mockResolvedValue(base);
    const user = renderDetail({}, UserRole.RECRUITER);
    await user.click(await screen.findByRole('button', { name: 'Sửa lịch' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Sửa lịch phỏng vấn',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );
    await waitFor(() =>
      expect(updateInterview).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({
          scheduledAt: '2030-11-03T09:00:00+07:00',
          round: 1,
        }),
      ),
    );
  });
});

describe('InterviewDetail layout', () => {
  it('splits into Kết quả, CV and Tin tabs on a narrow screen, result first', async () => {
    wide = false;
    const user = renderDetail();
    await screen.findByRole('heading', { name: /Nguyễn Văn An/ });
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Kết quả', 'CV', 'Tin']);
    expect(
      screen.getByRole('combobox', { name: /Kết quả/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Tải CV/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'CV' }));
    expect(
      await screen.findByRole('link', { name: /Tải CV/ }),
    ).toBeInTheDocument();
  });

  it('shows everything at once on a wide screen, without tabs', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: /Nguyễn Văn An/ });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(await screen.findByText('Tin tuyển dụng')).toBeInTheDocument();
  });

  it('says why an interviewer sees no job description', async () => {
    renderDetail();
    expect(
      await screen.findByText(/chỉ hiện với vai trò được xem tin tuyển dụng/),
    ).toBeInTheDocument();
  });

  it('shows the job description to roles that may read jobs', async () => {
    renderDetail({}, UserRole.RECRUITER);
    expect(await screen.findByText('Mô tả tin')).toBeInTheDocument();
  });
});
