import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { describeLoginError } from './login-error';

describe('describeLoginError', () => {
  it('answers a wrong email or password with one generic line', () => {
    expect(describeLoginError(new ApiError(401, ['bất kỳ'])).message).toBe(
      'Email hoặc mật khẩu không đúng.',
    );
  });

  it('says the account is locked on 403', () => {
    expect(
      describeLoginError(new ApiError(403, ['Tài khoản đã bị khóa'])),
    ).toEqual({
      message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
    });
  });

  it('passes the wait of a 429 on', () => {
    expect(describeLoginError(new ApiError(429, [], 42))).toEqual({
      message: 'Thử lại sau 42 giây.',
      retryAfter: 42,
    });
  });

  it('has no wait for a 429 without Retry-After', () => {
    expect(
      describeLoginError(new ApiError(429, [])).retryAfter,
    ).toBeUndefined();
  });

  it.each([
    ['a server error', new ApiError(500, [])],
    ['no network', new ApiError(0, [])],
    ['something unexpected', new Error('boom')],
  ])('uses the generic message for %s', (_name, error) => {
    expect(describeLoginError(error)).toEqual({
      message: 'Có lỗi xảy ra, vui lòng thử lại.',
      retryAfter: undefined,
    });
  });
});
