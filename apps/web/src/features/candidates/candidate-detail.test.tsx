import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ROLE_PERMISSIONS,
  UserRole,
  type Permission,
} from '@hiflow/shared-types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';

import {
  anonymizeCandidate,
  fetchCandidate,
  removeCandidateCv,
  updateCandidate,
  uploadCandidateCv,
  type CandidateDetail as Detail,
} from './candidate-api';
import { CandidateDetail } from './candidate-detail';

let role: UserRole = UserRole.RECRUITER;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => {
    const granted = ROLE_PERMISSIONS[role] as readonly Permission[];
    return { user: { role }, can: (p: Permission) => can(granted, p) };
  },
}));
vi.mock('./candidate-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./candidate-api')>()),
  fetchCandidate: vi.fn(),
  updateCandidate: vi.fn(),
  setCandidateNote: vi.fn(),
  uploadCandidateCv: vi.fn(),
  removeCandidateCv: vi.fn(),
  anonymizeCandidate: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const base: Detail = {
  id: 'c1',
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  phone: '0901234567',
  dob: '1995-05-20',
  source: 'REFERRAL',
  hasCv: true,
  note: 'Ghi chú cũ',
  anonymizedAt: null,
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
  applications: [
    {
      id: 'a1',
      jobId: 'j1',
      jobTitle: 'Kế toán',
      status: 'NEW',
      appliedAt: '2026-11-02T03:00:00.000Z',
    },
  ],
} as Detail;

function renderDetail(
  over: Partial<Detail> = {},
  as: UserRole = UserRole.RECRUITER,
) {
  role = as;
  vi.mocked(fetchCandidate).mockResolvedValue({ ...base, ...over });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <CandidateDetail id="c1" />
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

describe('CandidateDetail', () => {
  it('shows the profile, the applications with a link, and the CV download', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(screen.getByText('Giới thiệu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kế toán' })).toHaveAttribute(
      'href',
      '/applications/a1',
    );
    const download = screen.getByRole('link', { name: /Tải CV/ });
    expect(download).toHaveAttribute('href', '/api/candidates/c1/cv');
    expect(download).toHaveAttribute('target', '_blank');
  });

  it('offers a recruiter edit and CV management but not anonymising', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(names()).toEqual(expect.arrayContaining(['Sửa', 'Xóa CV']));
    expect(names()).not.toContain('Ẩn danh');
  });

  it('offers HR anonymising but no editing', async () => {
    renderDetail({}, UserRole.HR_MANAGER);
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    expect(names()).toContain('Ẩn danh');
    expect(names()).not.toContain('Sửa');
    expect(names()).not.toContain('Xóa CV');
  });

  it('hides every edit control of an anonymised candidate and says so', async () => {
    renderDetail(
      {
        anonymizedAt: '2026-11-05T03:00:00.000Z',
        fullName: 'Đã ẩn danh',
        hasCv: false,
      },
      UserRole.ADMIN,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'đã được ẩn danh',
    );
    for (const label of [
      'Sửa',
      'Ẩn danh',
      'Xóa CV',
      'Tải lên',
      'Sửa ghi chú',
    ]) {
      expect(names()).not.toContain(label);
    }
  });

  it('warns that anonymising cannot be undone and shows the API refusal in the dialog', async () => {
    vi.mocked(anonymizeCandidate).mockRejectedValue(
      new ApiError(409, [
        'Ứng viên còn hồ sơ đang xử lý nên không thể ẩn danh',
      ]),
    );
    const user = renderDetail({}, UserRole.HR_MANAGER);
    await user.click(await screen.findByRole('button', { name: 'Ẩn danh' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Ẩn danh ứng viên',
    });
    expect(dialog).toHaveTextContent('không thể hoàn tác');
    await user.click(
      within(dialog).getByRole('button', { name: 'Ẩn danh ứng viên' }),
    );
    expect(
      await within(dialog).findByText(/còn hồ sơ đang xử lý/),
    ).toBeInTheDocument();
  });

  it('removes the CV after confirmation', async () => {
    vi.mocked(removeCandidateCv).mockResolvedValue(base);
    const user = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Xóa CV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xóa CV' });
    await user.click(within(dialog).getByRole('button', { name: 'Xóa CV' }));
    await waitFor(() => expect(removeCandidateCv).toHaveBeenCalledWith('c1'));
  });

  it('checks the CV file in the browser before uploading', async () => {
    renderDetail({ hasCv: false });
    // The picker's `accept` is only a hint; a file can still be dropped or typed in.
    const user = userEvent.setup({ applyAccept: false });
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    await user.upload(
      screen.getByLabelText(/Tải CV lên/),
      new File(['x'], 'cv.txt', { type: 'text/plain' }),
    );
    await user.click(screen.getByRole('button', { name: 'Tải lên' }));
    expect(
      await screen.findByText('Chỉ chấp nhận tệp PDF hoặc DOCX.'),
    ).toBeInTheDocument();
    expect(uploadCandidateCv).not.toHaveBeenCalled();
  });

  it('uploads a valid CV', async () => {
    vi.mocked(uploadCandidateCv).mockResolvedValue(base);
    const user = renderDetail({ hasCv: false });
    await screen.findByRole('heading', { name: 'Nguyễn Văn An' });
    await user.upload(
      screen.getByLabelText(/Tải CV lên/),
      new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Tải lên' }));
    await waitFor(() =>
      expect(uploadCandidateCv).toHaveBeenCalledWith('c1', expect.any(File)),
    );
  });

  it('shows a duplicate email inside the edit dialog', async () => {
    vi.mocked(updateCandidate).mockRejectedValue(
      new ApiError(409, ['Email ứng viên đã tồn tại']),
    );
    const user = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sửa ứng viên' });
    await user.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );
    expect(
      await within(dialog).findByText('Email ứng viên đã tồn tại'),
    ).toBeInTheDocument();
  });
});
