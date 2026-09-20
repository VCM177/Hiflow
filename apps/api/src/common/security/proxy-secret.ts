import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const PROXY_SECRET_HEADER = 'x-hiflow-proxy-secret';

const digest = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

/**
 * Only the web app's proxy should reach the API, but the Cloud Run address is
 * public, so anyone could call it directly and pick their own X-Forwarded-For
 * (which the rate limiter trusts). Requests without the shared secret get the
 * same 404 an unknown route would, so the API does not advertise itself.
 */
export function proxySecretMiddleware(secret: string) {
  const expected = digest(secret);

  return (req: Request, res: Response, next: NextFunction): void => {
    const given = req.header(PROXY_SECRET_HEADER);

    // Hashing first gives both sides equal length, which timingSafeEqual needs.
    if (typeof given === 'string' && timingSafeEqual(digest(given), expected)) {
      next();
      return;
    }

    res.status(404).json({
      message: `Cannot ${req.method} ${req.path}`,
      error: 'Not Found',
      statusCode: 404,
    });
  };
}
