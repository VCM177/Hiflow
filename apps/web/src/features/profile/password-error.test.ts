import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { describePasswordError } from './password-error';

describe('describePasswordError', () => {
  it('puts a wrong current password on its field', () => {
    expect(
      describePasswordError(
        new ApiError(400, ['Mật khẩu hiện tại không đúng']),
      ),
    ).toEqual({
      kind: 'field',
      field: 'currentPassword',
      message: 'Mật khẩu hiện tại không đúng',
    });
  });

  it('puts every other 400 on the new password', () => {
    expect(
      describePasswordError(
        new ApiError(400, ['Mật khẩu mới phải khác mật khẩu hiện tại']),
      ),
    ).toMatchObject({ kind: 'field', field: 'newPassword' });
  });

  it('toasts a wait time for 429 and a generic error otherwise', () => {
    expect(describePasswordError(new ApiError(429, [], 20))).toEqual({
      kind: 'toast',
      message: 'Thử lại sau 20 giây.',
    });
    expect(describePasswordError(new ApiError(500, []))).toMatchObject({
      kind: 'toast',
    });
  });
});
