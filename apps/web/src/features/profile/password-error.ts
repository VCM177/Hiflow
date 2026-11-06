import { ApiError } from '@/lib/api/errors';

export type PasswordFailure =
  | { kind: 'field'; field: 'currentPassword' | 'newPassword'; message: string }
  | { kind: 'toast'; message: string };

const GENERIC = 'Có lỗi xảy ra, vui lòng thử lại.';

/** Puts an API refusal of a password change on the field it is about. */
export function describePasswordError(error: unknown): PasswordFailure {
  if (!(error instanceof ApiError)) return { kind: 'toast', message: GENERIC };
  if (error.status === 429) {
    return {
      kind: 'toast',
      message: error.retryAfter
        ? `Thử lại sau ${error.retryAfter} giây.`
        : 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
    };
  }
  if (error.status !== 400) return { kind: 'toast', message: GENERIC };
  const message = error.messages[0] ?? GENERIC;
  return /hiện tại không đúng/i.test(message)
    ? { kind: 'field', field: 'currentPassword', message }
    : { kind: 'field', field: 'newPassword', message };
}
