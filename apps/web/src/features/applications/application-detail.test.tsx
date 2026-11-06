import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ApplicationStatus,
  InterviewResult,
  OfferStatus,
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import {
  changeApplicationStatus,
  fetchApplication,
  respondToOffer,
  type ApplicationFull,
} from './application-api';
import { ApplicationDetail } from './application-detail';
import { todayText } from './offer-schema';

let role: UserRole = UserRole.RECRUITER;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
vi.mock('@/features/users/options', () => ({
  useUserOptions: () => ({
    options: [{ value: 'u1', label: 'Phỏng vấn viên A' }],
    isLoading: false,
  }),
}));
vi.mock('./application-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./application-api')>()),
  fetchApplication: vi.fn(),
  changeApplicationStatus: vi.fn(),
  changeApplicationAssignee: vi.fn(),
  setApplicationNote: vi.fn(),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
  respondToOffer: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const day = (offset: number) =>
  todayText(new Date(Date.now() + offset * 86_400_000));

const base = {
  id: 'a1',
  candidate: { id: 'c1', fullName: 'Nguyễn Văn An', email: 'an@example.com' },
  job: { id: 'j1', title: 'Kế toán', status: 'OPEN' },
  status: ApplicationStatus.NEW,
  appliedAt: '2026-11-02T03:00:00.000Z',
  assignee: null,
  note: null,
  hasCv: true,
  candidateDetail: { phone: '0901234567', hasCv: true },
  history: [
    {
      id: 'h1',
      fromStatus: null,
      toStatus: 'NEW',
      note: null,
      changedBy: null,
      changedAt: '2026-11-02T03:00:00.000Z',
    },
  ],
  interviews: [],
  offer: null,
} as unknown as ApplicationFull;

const offerOf = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  applicationId: 'a1',
  salary: 20_000_000,
  startDate: day(20),
  expiresAt: day(10),
  status: OfferStatus.PENDING,
  note: null,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

function renderDetail(
  over: Partial<ApplicationFull>,
  as: UserRole = UserRole.RECRUITER,
) {
  role = as;
  vi.mocked(fetchApplication).mockResolvedValue({
    ...base,
    ...over,
  } as ApplicationFull);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ApplicationDetail id="a1" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const buttons = () =>
  screen.queryAllByRole('button').map((el) => el.textContent?.trim());

beforeEach(() => vi.clearAllMocks());

describe('ApplicationDetail progress', () => {
  it('offers the step after Mới, reject and withdraw, but never Nhận việc', async () => {
    renderDetail({});
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(buttons()).toEqual(
      expect.arrayContaining([
        'Chuyển sang Sàng lọc',
        'Từ chối hồ sơ',
        'Ứng viên rút',
      ]),
    );
    expect(buttons()).not.toContain('Chuyển sang Đề nghị');
    expect(buttons().join()).not.toMatch(/Nhận việc/);
  });

  it('locks Đề nghị with the reason until a round passed', async () => {
    renderDetail({ status: ApplicationStatus.INTERVIEW });
    const button = await screen.findByRole('button', {
      name: 'Chuyển sang Đề nghị',
    });
    expect(button).toBeDisabled();
    expect(
      button.closest('[aria-describedby]')?.getAttribute('aria-describedby'),
    ).toBeTruthy();
  });

  it('opens Đề nghị after a passed round and moves on click', async () => {
    vi.mocked(changeApplicationStatus).mockResolvedValue(base);
    const user = renderDetail({
      status: ApplicationStatus.INTERVIEW,
      interviews: [
        {
          id: 'i1',
          round: 1,
          scheduledAt: '2026-11-03T03:00:00.000Z',
          interviewer: null,
          result: InterviewResult.PASSED,
          feedback: null,
        },
      ],
    });
    await user.click(
      await screen.findByRole('button', { name: 'Chuyển sang Đề nghị' }),
    );
    await waitFor(() =>
      expect(changeApplicationStatus).toHaveBeenCalledWith(
        'a1',
        ApplicationStatus.OFFER,
      ),
    );
  });

  it('needs a reason to reject', async () => {
    const user = renderDetail({});
    vi.mocked(changeApplicationStatus).mockResolvedValue(base);
    await user.click(
      await screen.findByRole('button', { name: 'Từ chối hồ sơ' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Từ chối hồ sơ' });
    await user.click(
      within(dialog).getByRole('button', { name: 'Từ chối hồ sơ' }),
    );
    expect(changeApplicationStatus).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole('textbox'), 'Không phù hợp');
    await user.click(
      within(dialog).getByRole('button', { name: 'Từ chối hồ sơ' }),
    );
    await waitFor(() =>
      expect(changeApplicationStatus).toHaveBeenCalledWith(
        'a1',
        ApplicationStatus.REJECTED,
        'Không phù hợp',
      ),
    );
  });

  it('shows the server refusal when another person moved the application first', async () => {
    vi.mocked(changeApplicationStatus).mockRejectedValue(
      new ApiError(409, ['Hồ sơ vừa được xử lý bởi người khác']),
    );
    const user = renderDetail({});
    await user.click(
      await screen.findByRole('button', { name: 'Ứng viên rút' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Ứng viên rút hồ sơ',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Ghi nhận ứng viên rút' }),
    );
    expect(
      await within(dialog).findByText(/xử lý bởi người khác/),
    ).toBeInTheDocument();
  });

  it('offers no status button on a finished application, to a manager, or to HR', async () => {
    renderDetail({ status: ApplicationStatus.REJECTED });
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(buttons().join()).not.toMatch(
      /Chuyển sang|Từ chối hồ sơ|Ứng viên rút/,
    );
  });

  it('gives a department manager contact details but no link to the candidate page', async () => {
    renderDetail({}, UserRole.DEPT_MANAGER);
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(screen.getByText('0901234567')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Nguyễn Văn An' }),
    ).not.toBeInTheDocument();
    expect(buttons().join()).not.toMatch(/Chuyển sang/);
  });

  it('links the candidate for roles who may open candidates', async () => {
    renderDetail({});
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(screen.getByRole('link', { name: 'Nguyễn Văn An' })).toHaveAttribute(
      'href',
      '/candidates/c1',
    );
  });

  it('puts the history in the timeline', async () => {
    renderDetail({});
    const list = await screen.findByRole('list', { name: 'Lịch sử hồ sơ' });
    expect(list).toHaveTextContent('Nộp hồ sơ (Mới)');
  });
});

describe('ApplicationDetail interviews', () => {
  it('books only at the interview step with no round waiting', async () => {
    const user = renderDetail({ status: ApplicationStatus.INTERVIEW });
    await user.click(await screen.findByRole('tab', { name: 'Phỏng vấn' }));
    expect(
      await screen.findByRole('button', { name: 'Đặt lịch' }),
    ).toBeInTheDocument();
  });

  it('does not offer booking while a round waits for its result', async () => {
    const user = renderDetail({
      status: ApplicationStatus.INTERVIEW,
      interviews: [
        {
          id: 'i1',
          round: 1,
          scheduledAt: '2030-11-03T03:00:00.000Z',
          interviewer: { id: 'u1', name: 'Phỏng vấn viên A' },
          result: InterviewResult.PENDING,
          feedback: null,
        },
      ],
    });
    await user.click(await screen.findByRole('tab', { name: 'Phỏng vấn' }));
    expect(await screen.findByText(/Vòng 1/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Đặt lịch' }),
    ).not.toBeInTheDocument();
  });

  it('does not offer booking at other steps', async () => {
    const user = renderDetail({ status: ApplicationStatus.SCREENING });
    await user.click(await screen.findByRole('tab', { name: 'Phỏng vấn' }));
    await screen.findByText('Chưa có lịch phỏng vấn.');
    expect(
      screen.queryByRole('button', { name: 'Đặt lịch' }),
    ).not.toBeInTheDocument();
  });
});

describe('ApplicationDetail offer', () => {
  it('has no Offer tab before the Offer step', async () => {
    renderDetail({ status: ApplicationStatus.INTERVIEW });
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(
      screen.queryByRole('tab', { name: 'Offer' }),
    ).not.toBeInTheDocument();
  });

  it('has no Offer tab for HR, even at the Offer step', async () => {
    renderDetail({ status: ApplicationStatus.OFFER }, UserRole.HR_MANAGER);
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(
      screen.queryByRole('tab', { name: 'Offer' }),
    ).not.toBeInTheDocument();
  });

  it('opens the tab at the Offer step and offers to create one', async () => {
    const user = renderDetail({ status: ApplicationStatus.OFFER });
    await user.click(await screen.findByRole('tab', { name: 'Offer' }));
    expect(
      await screen.findByRole('button', { name: 'Tạo đề nghị' }),
    ).toBeInTheDocument();
  });

  it('shows a pending offer with accept and decline, and explains the effects', async () => {
    vi.mocked(respondToOffer).mockResolvedValue(offerOf() as never);
    const user = renderDetail({
      status: ApplicationStatus.OFFER,
      offer: offerOf() as never,
    });
    await user.click(await screen.findByRole('tab', { name: 'Offer' }));
    await user.click(
      await screen.findByRole('button', { name: 'Ứng viên từ chối' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Ứng viên từ chối đề nghị',
    });
    expect(dialog).toHaveTextContent('Ứng viên rút');
    await user.click(
      within(dialog).getByRole('button', { name: 'Ghi nhận từ chối' }),
    );
    await waitFor(() =>
      expect(respondToOffer).toHaveBeenCalledWith('a1', false),
    );
  });

  it('hides Chấp nhận once the deadline passed, leaving only the refusal', async () => {
    const user = renderDetail({
      status: ApplicationStatus.OFFER,
      offer: offerOf({ expiresAt: day(-1) }) as never,
    });
    await user.click(await screen.findByRole('tab', { name: 'Offer' }));
    await screen.findByRole('button', { name: 'Ứng viên từ chối' });
    expect(
      screen.queryByRole('button', { name: 'Ứng viên chấp nhận' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/đã quá hạn/i)).toBeInTheDocument();
  });

  it('keeps the offer readable but locked once answered', async () => {
    const user = renderDetail({
      status: ApplicationStatus.HIRED,
      offer: offerOf({ status: OfferStatus.ACCEPTED }) as never,
    });
    await user.click(await screen.findByRole('tab', { name: 'Offer' }));
    expect(await screen.findByText('Đã chấp nhận')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sửa' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ứng viên chấp nhận' }),
    ).not.toBeInTheDocument();
  });
});
