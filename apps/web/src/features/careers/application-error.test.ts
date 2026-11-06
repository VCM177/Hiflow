import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { describeApplicationError } from './application-error';

describe('describeApplicationError', () => {
  it('puts a CV complaint on the file field', () => {
    expect(
      describeApplicationError(
        new ApiError(400, ['CV chỉ nhận PDF hoặc DOCX']),
      ),
    ).toMatchObject({ kind: 'field', field: 'cv' });
  });

  it('puts a field complaint on that field', () => {
    expect(
      describeApplicationError(
        new ApiError(400, ['Số điện thoại không hợp lệ']),
      ),
    ).toMatchObject({ kind: 'field', field: 'phone' });
    expect(
      describeApplicationError(
        new ApiError(400, ['Vui lòng đồng ý cho Hiflow xử lý dữ liệu']),
      ),
    ).toMatchObject({ kind: 'field', field: 'consent' });
  });

  it('shows other 400s above the form (captcha, unknown)', () => {
    expect(
      describeApplicationError(
        new ApiError(400, ['Xác minh chống spam không thành công']),
      ),
    ).toEqual({
      kind: 'form',
      message: 'Xác minh chống spam không thành công',
    });
  });

  it('maps 413 to the file field', () => {
    expect(describeApplicationError(new ApiError(413, []))).toMatchObject({
      kind: 'field',
      field: 'cv',
    });
  });

  it('keeps the wait time of a 429', () => {
    expect(describeApplicationError(new ApiError(429, [], 30))).toMatchObject({
      kind: 'wait',
      retryAfter: 30,
    });
  });

  it('treats 404 as a closed job', () => {
    expect(describeApplicationError(new ApiError(404, []))).toEqual({
      kind: 'closed',
    });
  });

  it('says the service is unavailable for 5xx and network failures', () => {
    for (const status of [500, 503, 0]) {
      expect(describeApplicationError(new ApiError(status, []))).toMatchObject({
        kind: 'form',
        message: expect.stringContaining('tạm thời không khả dụng'),
      });
    }
  });
});
