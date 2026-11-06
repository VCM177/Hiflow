import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import {
  InterviewResult,
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { can } from '@/lib/permissions';

import { fetchInterviews, type Interview } from './interview-api';
import { InterviewsPage } from './interviews-page';

let role: UserRole = UserRole.INTERVIEWER;
let currentQuery = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/interviews',
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
vi.mock('@/features/users/options', () => ({
  useUserOptions: () => ({
    options: [{ value: 'u1', label: 'Phỏng vấn viên A' }],
    isLoading: false,
  }),
}));
vi.mock('./interview-api', () => ({ fetchInterviews: vi.fn() }));

const item: Interview = {
  id: 'i1',
  application: {
    id: 'a1',
    candidate: { id: 'c1', fullName: 'Nguyễn Văn An' },
    job: { id: 'j1', title: 'Kế toán' },
  },
  round: 2,
  scheduledAt: '2030-11-03T02:00:00.000Z',
  interviewer: { id: 'u1', name: 'Phỏng vấn viên A' },
  result: InterviewResult.PENDING,
  feedback: null,
  createdAt: '',
  updatedAt: '',
};

function renderPage(as: UserRole = UserRole.INTERVIEWER) {
  role = as;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <InterviewsPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentQuery = '';
  vi.mocked(fetchInterviews).mockResolvedValue({
    items: [item],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  });
});

describe('InterviewsPage', () => {
  it('lists candidate, job, round, time in Vietnam time, interviewer and result', async () => {
    renderPage();
    const line = (await screen.findByText('Nguyễn Văn An')).closest('tr')!;
    expect(within(line).getByText('Kế toán')).toBeInTheDocument();
    expect(within(line).getByText('2')).toBeInTheDocument();
    expect(within(line).getByText(/03\/11\/2030 09:00/)).toBeInTheDocument();
    expect(within(line).getByText('Phỏng vấn viên A')).toBeInTheDocument();
    expect(within(line).getByText('Chờ kết quả')).toBeInTheDocument();
    expect(within(line).getByRole('link')).toHaveAttribute(
      'href',
      '/interviews/i1',
    );
  });

  it('asks for the soonest first by default', async () => {
    renderPage();
    await screen.findByText('Nguyễn Văn An');
    expect(fetchInterviews).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'scheduledAt', sortDir: 'asc' }),
      expect.anything(),
    );
  });

  it('opens with the result chosen when the address says so (the interviewer’s landing page)', async () => {
    currentQuery = 'result=PENDING';
    renderPage();
    await screen.findByText('Nguyễn Văn An');
    expect(fetchInterviews).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'PENDING' }),
      expect.anything(),
    );
    expect(
      screen.getByRole('combobox', { name: 'Lọc theo kết quả' }),
    ).toHaveTextContent('Chờ kết quả');
  });

  it('ignores a round or result the API would refuse', async () => {
    currentQuery = 'result=BOGUS&round=99';
    renderPage();
    await screen.findByText('Nguyễn Văn An');
    expect(fetchInterviews).toHaveBeenCalledWith(
      expect.objectContaining({ result: undefined, round: undefined }),
      expect.anything(),
    );
  });

  it('says there is nothing, and why, when the list is empty', async () => {
    vi.mocked(fetchInterviews).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
    renderPage();
    expect(
      await screen.findByText('Chưa có lịch phỏng vấn nào'),
    ).toBeInTheDocument();
  });
});
