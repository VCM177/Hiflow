import { ApiError } from '@/lib/api/errors';

/** Where a failed submission is shown, and what the page does next. */
export type ApplicationFailure =
  | {
      kind: 'field';
      field: 'cv' | 'fullName' | 'email' | 'phone' | 'consent';
      message: string;
    }
  | { kind: 'form'; message: string }
  | { kind: 'wait'; message: string; retryAfter: number | undefined }
  | { kind: 'closed' };

const FILE_WORDS = /\b(cv|tệp|file|pdf|docx)\b/i;
const TEMPORARY =
  'Hệ thống tạm thời không khả dụng, vui lòng thử lại sau ít phút.';

const FIELD_HINTS: ReadonlyArray<
  readonly [RegExp, 'fullName' | 'email' | 'phone' | 'consent']
> = [
  [/họ tên/i, 'fullName'],
  [/email/i, 'email'],
  [/điện thoại/i, 'phone'],
  [/đồng ý/i, 'consent'],
];

/** Maps the API's answer to a submission (docs/web-plan-detail.md B7.1 task 1.4). */
export function describeApplicationError(error: unknown): ApplicationFailure {
  if (!(error instanceof ApiError)) return { kind: 'form', message: TEMPORARY };

  switch (error.status) {
    case 400: {
      const message = error.messages[0] ?? 'Dữ liệu chưa hợp lệ.';
      if (FILE_WORDS.test(message))
        return { kind: 'field', field: 'cv', message };
      const hint = FIELD_HINTS.find(([pattern]) => pattern.test(message));
      return hint
        ? { kind: 'field', field: hint[1], message }
        : { kind: 'form', message };
    }
    case 413:
      return { kind: 'field', field: 'cv', message: 'Tệp CV tối đa 5 MB.' };
    case 404:
      return { kind: 'closed' };
    case 429:
      return {
        kind: 'wait',
        message: 'Bạn đã gửi quá nhiều lần.',
        retryAfter: error.retryAfter,
      };
    default:
      return { kind: 'form', message: TEMPORARY };
  }
}
