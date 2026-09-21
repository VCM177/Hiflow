import { minutes, seconds, type ThrottlerOptions } from '@nestjs/throttler';
import { THROTTLE_POLICY } from './throttle.constants';

const MAX_EMAIL_LENGTH = 254;

/**
 * Keys the counter on the account being attacked, so a password guesser who
 * rotates IP addresses still hits a wall. The body is already parsed here (JSON)
 * but not yet validated, so anything that is not a string falls back to the IP.
 */
export const accountTracker = (req: Record<string, unknown>): string => {
  const body = req.body as { email?: unknown } | undefined;
  const email =
    typeof body?.email === 'string'
      ? body.email.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH)
      : '';

  return email ? `acct:${email}` : `ip:${String(req.ip)}`;
};

/** `scale` multiplies every limit; e2e raises it so shared logins are not throttled. */
export const buildThrottlers = (scale: number): ThrottlerOptions[] => [
  {
    name: THROTTLE_POLICY.LOGIN_IP,
    ttl: seconds(60),
    limit: 10 * scale,
  },
  {
    // Browsing the job board: generous for a person, tight for a scraper.
    name: THROTTLE_POLICY.PUBLIC_READ_IP,
    ttl: seconds(60),
    limit: 60 * scale,
  },
  {
    name: THROTTLE_POLICY.LOGIN_ACCOUNT,
    ttl: minutes(15),
    limit: 20 * scale,
    getTracker: accountTracker,
  },
];
