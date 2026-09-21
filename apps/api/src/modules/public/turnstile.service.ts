import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5_000;
/** Cloudflare documents 2048 characters as the longest token. */
const MAX_TOKEN_LENGTH = 2048;

type FetchFn = typeof fetch;

/**
 * Checks the Cloudflare Turnstile token that proves the form was filled in by a
 * browser that passed the challenge. With no secret configured (development
 * and tests) it lets everything through; production refuses to boot without one.
 */
export class TurnstileService {
  private readonly logger = new Logger('Turnstile');

  constructor(
    private readonly secret: string | undefined,
    private readonly fetchFn: FetchFn = (...args) => fetch(...args),
  ) {
    if (!secret) {
      this.logger.warn('TURNSTILE_SECRET is not set: captcha is not checked');
    }
  }

  /** Throws 400 when the token is missing or refused, 503 when Cloudflare cannot be asked. */
  async verify(token: unknown, ip: string): Promise<void> {
    if (!this.secret) return;

    if (
      typeof token !== 'string' ||
      token === '' ||
      token.length > MAX_TOKEN_LENGTH
    ) {
      throw new BadRequestException(
        'Vui lòng hoàn tất bước xác minh chống spam',
      );
    }

    let outcome: { success?: boolean };
    try {
      const response = await this.fetchFn(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secret,
          response: token,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      outcome = (await response.json()) as { success?: boolean };
    } catch (error) {
      // Fail closed: without an answer we cannot tell a person from a script.
      this.logger.warn(
        `Could not verify a token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Chưa xác minh được, vui lòng thử lại sau ít phút',
      );
    }

    if (outcome.success !== true) {
      throw new BadRequestException(
        'Xác minh chống spam không thành công, vui lòng thử lại',
      );
    }
  }
}
