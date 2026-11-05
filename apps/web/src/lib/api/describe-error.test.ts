import { describe, expect, it } from 'vitest';

import { describeApiError } from './describe-error';
import { ApiError } from './errors';

describe('describeApiError', () => {
  it('shows a 400 on its field when the caller names one', () => {
    expect(
      describeApiError(new ApiError(400, ['Email không hợp lệ']), {
        field: 'email',
      }),
    ).toEqual({ kind: 'field', field: 'email', message: 'Email không hợp lệ' });
  });

  it('shows a 400 inline when no field is known', () => {
    expect(describeApiError(new ApiError(400, ['Sai dữ liệu']))).toEqual({
      kind: 'inline',
      message: 'Sai dữ liệu',
      reload: false,
    });
  });

  it('sends a 401 to the login page', () => {
    expect(describeApiError(new ApiError(401, []))).toEqual({
      kind: 'login',
      message: 'Phiên đăng nhập đã hết hạn.',
    });
  });

  it('shows a 403 as a toast without refreshing', () => {
    expect(describeApiError(new ApiError(403, []))).toEqual({
      kind: 'toast',
      message: 'Bạn không có quyền thực hiện thao tác này.',
      refresh: false,
    });
  });

  it('treats a 404 as a toast that refreshes the list', () => {
    expect(describeApiError(new ApiError(404, []))).toMatchObject({
      kind: 'toast',
      refresh: true,
    });
  });

  it('shows a 409 with the server message verbatim', () => {
    expect(
      describeApiError(new ApiError(409, ['Ứng viên đang ở trạng thái khác'])),
    ).toEqual({
      kind: 'inline',
      message: 'Ứng viên đang ở trạng thái khác',
      reload: false,
    });
  });

  it('offers a reload when the conflict says another user handled it first', () => {
    expect(
      describeApiError(
        new ApiError(409, ['Hồ sơ này vừa được xử lý bởi người khác.']),
      ),
    ).toMatchObject({ kind: 'inline', reload: true });
  });

  it('shows a 413 on its field when the caller names one', () => {
    expect(describeApiError(new ApiError(413, []), { field: 'cv' })).toEqual({
      kind: 'field',
      field: 'cv',
      message: 'Tệp quá lớn.',
    });
  });

  it('shows a 429 with the countdown from Retry-After', () => {
    expect(describeApiError(new ApiError(429, [], 30))).toEqual({
      kind: 'retry',
      message: 'Thử lại sau 30 giây.',
      retryAfter: 30,
    });
  });

  it('shows a 429 without a countdown when the header is missing', () => {
    expect(describeApiError(new ApiError(429, []))).toMatchObject({
      kind: 'retry',
      retryAfter: undefined,
    });
  });

  it('shows a 5xx as a retry toast and keeps the form input (no field, no refresh)', () => {
    expect(describeApiError(new ApiError(500, []))).toEqual({
      kind: 'toast',
      message: 'Có lỗi xảy ra, vui lòng thử lại.',
      refresh: false,
    });
  });

  it('shows a network failure (status 0) the same way', () => {
    expect(describeApiError(new ApiError(0, []))).toMatchObject({
      kind: 'toast',
    });
  });

  it('treats any non-API error as a generic toast', () => {
    expect(describeApiError(new TypeError('boom'))).toMatchObject({
      kind: 'toast',
      message: 'Có lỗi xảy ra, vui lòng thử lại.',
    });
  });
});
