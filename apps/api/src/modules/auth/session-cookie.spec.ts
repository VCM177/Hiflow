import type { Request } from 'express';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  tokenFromCookie,
} from './session-cookie';

const requestWith = (cookies?: Record<string, unknown>): Request =>
  ({ cookies }) as unknown as Request;

describe('sessionCookieOptions', () => {
  it('is HttpOnly, Secure, SameSite=Strict and site-wide', () => {
    expect(sessionCookieOptions(60_000)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60_000,
    });
  });

  it.each([undefined, 0, -5])(
    'leaves out Max-Age when there is no positive lifetime (%s)',
    (maxAge) => {
      expect(sessionCookieOptions(maxAge)).not.toHaveProperty('maxAge');
    },
  );
});

describe('tokenFromCookie', () => {
  it('reads the session cookie', () => {
    expect(tokenFromCookie(requestWith({ [SESSION_COOKIE]: 'abc.def' }))).toBe(
      'abc.def',
    );
  });

  it.each([
    ['no cookie parser ran', undefined],
    ['other cookies only', { theme: 'dark' }],
    ['an empty value', { [SESSION_COOKIE]: '' }],
    ['a non-string value', { [SESSION_COOKIE]: { a: 1 } }],
  ])('gives null for %s', (_label, cookies) => {
    expect(tokenFromCookie(requestWith(cookies))).toBeNull();
  });
});
