import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE = 'hf_access_token';

/**
 * Scripts cannot read it (HttpOnly), it only travels over HTTPS (Secure), and
 * the browser never attaches it to a request started from another site
 * (SameSite=Strict), which is what closes cross-site request forgery.
 */
export const sessionCookieOptions = (maxAgeMs?: number): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
  ...(maxAgeMs && maxAgeMs > 0 ? { maxAge: maxAgeMs } : {}),
});

/** passport-jwt extractor: the token in the session cookie, if there is one. */
export const tokenFromCookie = (request: Request): string | null => {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[SESSION_COOKIE];

  return typeof value === 'string' && value !== '' ? value : null;
};
