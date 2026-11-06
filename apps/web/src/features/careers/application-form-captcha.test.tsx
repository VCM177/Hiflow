import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const apiRequest = vi.fn();
let widget: {
  onToken: (token: string | null) => void;
  resetSignal: number;
} | null = null;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/client', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
// The real widget loads Cloudflare's script; here it only hands its props to the test.
vi.mock('./turnstile-widget', () => ({
  TurnstileWidget: (props: {
    onToken: (t: string | null) => void;
    resetSignal: number;
  }) => {
    widget = props;
    return <div data-testid="captcha" />;
  },
}));

// The site key is read when the module loads, so each test loads it with the key it wants.
async function renderWithKey(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
  else vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', key);
  const { ApplicationForm } = await import('./application-form');
  // Same registry as the form, so `instanceof ApiError` holds inside it.
  const { ApiError } = await import('@/lib/api/errors');
  render(<ApplicationForm jobId="j1" thanksPath="/careers/x/thanks" />);
  return { user: userEvent.setup(), ApiError };
}

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

beforeEach(() => {
  push.mockReset();
  apiRequest.mockReset();
  widget = null;
});
afterEach(() => vi.unstubAllEnvs());

describe('ApplicationForm captcha', () => {
  it('shows no challenge and sends no token when there is no site key', async () => {
    apiRequest.mockResolvedValue({});
    const { user } = await renderWithKey(undefined);
    expect(screen.queryByTestId('captcha')).not.toBeInTheDocument();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const body = (apiRequest.mock.calls[0][2] as { body: FormData }).body;
    expect(body.has('turnstileToken')).toBe(false);
  });

  it('shows the challenge, and does not send until it is passed', async () => {
    const { user } = await renderWithKey('1x00000000000000000000AA');
    expect(screen.getByTestId('captcha')).toBeInTheDocument();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(
      await screen.findByText('Vui lòng hoàn tất bước xác minh chống spam.'),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('sends the token once the challenge is passed', async () => {
    apiRequest.mockResolvedValue({});
    const { user } = await renderWithKey('1x00000000000000000000AA');
    await fillValid(user);
    widget!.onToken('tok-123');
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const body = (apiRequest.mock.calls[0][2] as { body: FormData }).body;
    expect(body.get('turnstileToken')).toBe('tok-123');
  });

  it('asks for a fresh token after a failed attempt, since a token works once', async () => {
    const { user, ApiError } = await renderWithKey('1x00000000000000000000AA');
    apiRequest.mockRejectedValue(
      new ApiError(400, [
        'Xác minh chống spam không thành công, vui lòng thử lại',
      ]),
    );
    await fillValid(user);
    widget!.onToken('tok-123');
    const before = widget!.resetSignal;
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(
      await screen.findByText(/Xác minh chống spam không thành công/),
    ).toBeInTheDocument();
    await waitFor(() => expect(widget!.resetSignal).toBeGreaterThan(before));
    // the old token is gone: sending again needs the challenge again
    apiRequest.mockClear();
    await user.click(screen.getByRole('button', { name: 'Gửi hồ sơ' }));
    expect(
      await screen.findByText('Vui lòng hoàn tất bước xác minh chống spam.'),
    ).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
