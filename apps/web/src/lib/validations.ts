import { z } from 'zod';

// Shared rules from the business flow (docs/web-plan-detail.md, 1.6). The API checks
// the same rules again; the form uses these to report early. Messages are Vietnamese.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

/** New password: 8 to 72 characters, at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { error: `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự.` })
  .max(PASSWORD_MAX, { error: `Mật khẩu tối đa ${PASSWORD_MAX} ký tự.` })
  .refine((value) => /[A-Za-z]/.test(value), {
    error: 'Mật khẩu cần ít nhất một chữ cái.',
  })
  .refine((value) => /\d/.test(value), {
    error: 'Mật khẩu cần ít nhất một chữ số.',
  });

/** Email: trimmed, lower-cased before it is sent, at most 150 characters. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(150, { error: 'Email tối đa 150 ký tự.' })
  .pipe(z.email({ error: 'Email không hợp lệ.' }));

/**
 * Vietnamese phone number. Spaces, dots, dashes and brackets are removed first;
 * the result must be +84 or 0, then 9 or 10 digits.
 */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s.\-()]/g, ''))
  .pipe(
    z.string().regex(/^(?:\+84|0)\d{9,10}$/, {
      error: 'Số điện thoại không hợp lệ.',
    }),
  );

/** Name on the public application form: 2 to 100 characters, one line, no hidden or control characters. */
export const publicFullNameSchema = z
  .string()
  .trim()
  .min(2, { error: 'Họ tên cần ít nhất 2 ký tự.' })
  .max(100, { error: 'Họ tên tối đa 100 ký tự.' })
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), {
    error: 'Họ tên chứa ký tự không hợp lệ.',
  });

/** Name in internal forms: trimmed, required, at most 100 characters. */
export const internalFullNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Vui lòng nhập họ tên.' })
  .max(100, { error: 'Họ tên tối đa 100 ký tự.' });

/** Consent to process personal data on the public form: must be ticked. */
export const consentSchema = z.literal(true, {
  error: 'Bạn cần đồng ý để gửi hồ sơ.',
});

/** A category code: 2 to 30 letters, digits or underscores. The API stores it upper-case. */
export const categoryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{2,30}$/, {
    error: 'Mã chỉ gồm chữ, số hoặc dấu gạch dưới (2 đến 30 ký tự).',
  });

/** Free text that must not be empty: a rejection reason, a review note. */
export const requiredReasonSchema = z
  .string()
  .trim()
  .min(1, { error: 'Vui lòng nhập lý do.' });

/** A monthly salary range in VND: min must not exceed max. */
export const salaryRangeSchema = z
  .object({
    salaryMin: z.number().int().nonnegative(),
    salaryMax: z.number().int().nonnegative(),
  })
  .refine((range) => range.salaryMin <= range.salaryMax, {
    error: 'Lương tối thiểu không được lớn hơn lương tối đa.',
    path: ['salaryMax'],
  });

/** An offer salary: a whole number from 1 to 10,000,000,000 VND. */
export const offerSalarySchema = z
  .number()
  .int({ error: 'Lương phải là số nguyên.' })
  .min(1, { error: 'Lương phải lớn hơn 0.' })
  .max(10_000_000_000, { error: 'Lương tối đa 10.000.000.000 ₫.' });

export const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_EXTENSIONS = ['.pdf', '.docx'] as const;

/**
 * Checks a CV before upload: PDF or DOCX only (the legacy .doc format is refused),
 * at most 5 MB. Returns the message to show, or null when the file is acceptable.
 * The API checks the file content as well; this only catches the obvious cases early.
 */
export function cvFileError(file: {
  name: string;
  size: number;
}): string | null {
  const lower = file.name.toLowerCase();
  const allowed = CV_EXTENSIONS.some((extension) => lower.endsWith(extension));
  if (!allowed) return 'Chỉ chấp nhận tệp PDF hoặc DOCX.';
  if (file.size > CV_MAX_BYTES) return 'Tệp CV tối đa 5 MB.';
  return null;
}

/** True when `birthDate` makes the person at least `minimumAge` years old on `now`. */
export function isOldEnough(
  birthDate: Date,
  now: Date,
  minimumAge = 16,
): boolean {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - minimumAge);
  return birthDate.getTime() <= cutoff.getTime();
}

/** An interview time must be in the future. */
export function isInTheFuture(value: Date, now: Date): boolean {
  return value.getTime() > now.getTime();
}

/**
 * Offer dates: the start date is not in the past; the response deadline is not in the
 * past and not after the start date. Returns the Vietnamese message, or null.
 */
export function offerDatesError(
  startDate: Date,
  responseDeadline: Date,
  now: Date,
): string | null {
  if (startDate.getTime() < startOfDay(now).getTime()) {
    return 'Ngày nhận việc không được ở quá khứ.';
  }
  if (responseDeadline.getTime() < startOfDay(now).getTime()) {
    return 'Hạn phản hồi không được ở quá khứ.';
  }
  if (responseDeadline.getTime() > startDate.getTime()) {
    return 'Hạn phản hồi không được sau ngày nhận việc.';
  }
  return null;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** A whole-number count typed in a text box, from `min` to `max`: "5" → 5. */
export function countSchema(min: number, max: number, label: string) {
  const name = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  return z
    .string()
    .trim()
    .min(1, { error: `Vui lòng nhập ${label}.` })
    .transform((value, context) => {
      const count = Number(value);
      const problem = !Number.isFinite(count)
        ? `${name} phải là số.`
        : !Number.isInteger(count)
          ? `${name} phải là số nguyên.`
          : count < min
            ? `${name} tối thiểu ${min}.`
            : count > max
              ? `${name} tối đa ${max}.`
              : null;
      if (problem) {
        context.addIssue({ code: 'custom', message: problem });
        return z.NEVER;
      }
      return count;
    });
}

/** An optional amount of money in VND typed in a text box: blank → undefined, "5000000" → 5000000. */
export const optionalAmountSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === '') return undefined;
    const amount = Number(value.replace(/[.,\s]/g, ''));
    if (!Number.isInteger(amount) || amount < 0) {
      context.addIssue({
        code: 'custom',
        message: 'Số tiền phải là số nguyên không âm.',
      });
      return z.NEVER;
    }
    return amount;
  });
