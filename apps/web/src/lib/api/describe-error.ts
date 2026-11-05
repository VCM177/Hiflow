import { ApiError } from './errors';

/**
 * How a failed request is shown. Components render the `kind`; they never read
 * status codes themselves.
 *   field   — attach `message` to the named field
 *   inline  — show `message` next to the action (dialog confirm, form footer)
 *   toast   — show `message` as a toast
 *   login   — the session ended: send the user to the login page
 *   retry   — too many requests: show `message` and a countdown from `retryAfter`
 */
export type ErrorPresentation =
  | { kind: 'field'; field: string; message: string }
  | { kind: 'inline'; message: string; reload: boolean }
  | { kind: 'toast'; message: string; refresh: boolean }
  | { kind: 'login'; message: string }
  | { kind: 'retry'; message: string; retryAfter: number | undefined };

export interface DescribeOptions {
  /** The form field this request maps to, when the caller knows one. */
  field?: string;
}

const GENERIC = 'Có lỗi xảy ra, vui lòng thử lại.';
const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const NOT_FOUND = 'Không tìm thấy dữ liệu. Danh sách sẽ được làm mới.';
const SESSION_ENDED = 'Phiên đăng nhập đã hết hạn.';
const TOO_LARGE = 'Tệp quá lớn.';
// The API says "đã được xử lý bởi người khác" (or similar) when another user won a race.
const HANDLED_BY_OTHER = /người khác|vừa được xử lý/i;

/** Maps any error from the API (or the network) to the one way it should be shown. */
export function describeApiError(
  error: unknown,
  options: DescribeOptions = {},
): ErrorPresentation {
  if (!(error instanceof ApiError)) {
    return { kind: 'toast', message: GENERIC, refresh: false };
  }

  const serverMessage = error.messages[0];

  switch (error.status) {
    case 400:
      return withField(serverMessage ?? GENERIC, options);

    case 401:
      return { kind: 'login', message: SESSION_ENDED };

    case 403:
      return { kind: 'toast', message: FORBIDDEN, refresh: false };

    case 404:
      return { kind: 'toast', message: NOT_FOUND, refresh: true };

    case 409: {
      const message = serverMessage ?? GENERIC;
      return {
        kind: 'inline',
        message,
        reload: HANDLED_BY_OTHER.test(message),
      };
    }

    case 413:
      return withField(TOO_LARGE, options);

    case 429:
      return {
        kind: 'retry',
        message: error.retryAfter
          ? `Thử lại sau ${error.retryAfter} giây.`
          : 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
        retryAfter: error.retryAfter,
      };

    default:
      // 5xx and network failures (status 0): keep the user's input, show a retry hint.
      return { kind: 'toast', message: GENERIC, refresh: false };
  }
}

function withField(
  message: string,
  options: DescribeOptions,
): ErrorPresentation {
  if (options.field) {
    return { kind: 'field', field: options.field, message };
  }
  return { kind: 'inline', message, reload: false };
}
