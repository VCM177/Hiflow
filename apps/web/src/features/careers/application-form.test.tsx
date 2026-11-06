import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { ApplicationForm } from './application-form';

const push = vi.fn();
const apiRequest = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/client', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Họ và tên/), 'Nguyễn Văn A');
  await user.type(screen.getByLabelText(/^Email/), 'a@example.com');
  await user.type(screen.getByLabelText(/^Số điện thoại/), '0901234567');
  await user.upload(
    screen.getByLabelText(/^CV/),
    new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }),
  );
  await user.click(screen.getByRole('checkbox'));
}

describe('ApplicationForm', () => {
  beforeEach(() => {
    push.mockReset();
    apiRequest.mockReset();
  });

  it('states the file rule before a file is chosen', () => {
    render(<ApplicationForm jobId="j1" thanksPath="/careers/x/thanks" />);
    expect(screen.getByText('PDF hoặc DOCX, tối đa 5 MB.')).toBeInTheDocument();
  });

  it('sends multipart to the job and goes to the thank-you page', async () => {
    apiRequest.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();
    render(<ApplicationForm jobId="j1" thanksPath="/careers/x/thanks" />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/careers/x/thanks'));
    const [method, path, options] = apiRequest.mock.calls[0] as [
      string,
      string,
      { body: FormData },
    ];
    expect(method).toBe('POST');
    expect(path).toBe('/public/jobs/j1/applications');
    expect(options.body.get('email')).toBe('a@example.com');
    expect(options.body.get('consent')).toBe('true');
  });

  it('blocks submission without consent and does not call the API', async () => {
    const user = userEvent.setup();
    render(<ApplicationForm jobId="j1" thanksPath="/t" />);
    await user.type(screen.getByLabelText(/^Họ và tên/), 'Nguyễn Văn A');
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(
      await screen.findByText('Bạn cần đồng ý để gửi hồ sơ.'),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('shows a CV complaint from the API at the file field and keeps the input', async () => {
    apiRequest.mockRejectedValue(
      new ApiError(400, ['CV không đúng định dạng PDF']),
    );
    const user = userEvent.setup();
    render(<ApplicationForm jobId="j1" thanksPath="/t" />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(
      await screen.findByText('CV không đúng định dạng PDF'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveValue('a@example.com');
    expect(push).not.toHaveBeenCalled();
  });

  it('counts down after a 429 and disables the button', async () => {
    apiRequest.mockRejectedValue(new ApiError(429, [], 30));
    const user = userEvent.setup();
    render(<ApplicationForm jobId="j1" thanksPath="/t" />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(await screen.findByText(/Thử lại sau 30 giây/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi hồ sơ' })).toBeDisabled();
  });

  it('says the service is unavailable on a 503', async () => {
    apiRequest.mockRejectedValue(new ApiError(503, []));
    const user = userEvent.setup();
    render(<ApplicationForm jobId="j1" thanksPath="/t" />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(
      await screen.findByText(/tạm thời không khả dụng/),
    ).toBeInTheDocument();
  });

  it('shows the closed message on a 404', async () => {
    apiRequest.mockRejectedValue(new ApiError(404, []));
    const user = userEvent.setup();
    render(<ApplicationForm jobId="j1" thanksPath="/t" />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(await screen.findByText(/vừa ngừng nhận hồ sơ/)).toBeInTheDocument();
  });
});
