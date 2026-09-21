import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

const answer = (body: unknown, ok = true) =>
  jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  });

const serviceWith = (fetchFn: jest.Mock) =>
  new TurnstileService('secret-key', fetchFn);

describe('TurnstileService', () => {
  // Failures are logged on purpose; keep the test output readable.
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lets everything through when no secret is configured', async () => {
    const fetchFn = jest.fn();
    const service = new TurnstileService(undefined, fetchFn);

    await expect(service.verify(undefined, '1.2.3.4')).resolves.toBeUndefined();
    await expect(
      service.verify('anything', '1.2.3.4'),
    ).resolves.toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('accepts a token Cloudflare confirms, sending the secret, token and address', async () => {
    const fetchFn = answer({ success: true });

    await serviceWith(fetchFn).verify('the-token', '203.0.113.7');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(init.method).toBe('POST');
    const sent = init.body as URLSearchParams;
    expect(sent.get('secret')).toBe('secret-key');
    expect(sent.get('response')).toBe('the-token');
    expect(sent.get('remoteip')).toBe('203.0.113.7');
  });

  it.each([
    [
      'a refused token',
      { success: false, 'error-codes': ['invalid-input-response'] },
    ],
    ['an answer without success', {}],
    ['success that is not literally true', { success: 'true' }],
  ])('answers 400 for %s', async (_label, body) => {
    await expect(
      serviceWith(answer(body)).verify('t', '1.2.3.4'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['a missing token', undefined],
    ['an empty token', ''],
    ['a non-string token', { $ne: '' }],
    ['a token longer than Cloudflare allows', 'x'.repeat(2049)],
  ])('answers 400 for %s without calling Cloudflare', async (_label, token) => {
    const fetchFn = answer({ success: true });

    await expect(
      serviceWith(fetchFn).verify(token, '1.2.3.4'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  describe('when Cloudflare cannot be asked, it fails closed', () => {
    it('on a network error', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        serviceWith(fetchFn).verify('t', '1.2.3.4'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('on an HTTP error', async () => {
      await expect(
        serviceWith(answer({}, false)).verify('t', '1.2.3.4'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('on an answer that is not JSON', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      });

      await expect(
        serviceWith(fetchFn).verify('t', '1.2.3.4'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
