import { ApiError } from '@/lib/api/errors';
import { describeApiError } from '@/lib/api/describe-error';

export interface LoginFailure {
  message: string;
  /** Seconds before another attempt is allowed (429 only). */
  retryAfter?: number;
}

const LOCKED = 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
const WRONG = 'Email hoặc mật khẩu không đúng.';

/**
 * Login has its own wording: here a 401 means a wrong email or password (never
 * "session ended") and a 403 means the account is locked (never "no permission").
 * The 401 text is the same for an unknown email and a wrong password.
 */
export function describeLoginError(error: unknown): LoginFailure {
  if (error instanceof ApiError) {
    if (error.status === 401) return { message: WRONG };
    if (error.status === 403) return { message: LOCKED };
  }
  const shown = describeApiError(error);
  return {
    message: shown.message,
    retryAfter: shown.kind === 'retry' ? shown.retryAfter : undefined,
  };
}
