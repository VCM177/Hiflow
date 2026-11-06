import { z } from 'zod';

import { countSchema } from '@/lib/validations';

const dateText = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: 'Ngày không hợp lệ.',
  });

/** Today as yyyy-MM-dd in Vietnam time, the day offers are compared against. */
export function todayText(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
}

const salaryRule = countSchema(1, 10_000_000_000, 'mức lương');

/**
 * The offer form: monthly salary from 1 to 10,000,000,000 VND, a start date that is not in
 * the past, and an optional answer deadline that is not in the past and not after the start.
 */
export const offerSchema = z
  .object({
    // Kept as the text typed (so the form's values are the same going in and out); the
    // number is read in `toOfferBody`.
    salary: z
      .string()
      .trim()
      .superRefine((value, context) => {
        const parsed = salaryRule.safeParse(value);
        if (!parsed.success) {
          context.addIssue({
            code: 'custom',
            message:
              parsed.error.issues[0]?.message ?? 'Mức lương không hợp lệ.',
          });
        }
      }),
    startDate: dateText.min(1, { error: 'Vui lòng chọn ngày nhận việc.' }),
    expiresAt: dateText,
    note: z.string().trim().max(2000, { error: 'Ghi chú tối đa 2000 ký tự.' }),
  })
  .superRefine((value, context) => {
    const today = todayText();
    if (value.startDate && value.startDate < today) {
      context.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'Ngày nhận việc không được ở quá khứ.',
      });
    }
    if (value.expiresAt) {
      if (value.expiresAt < today) {
        context.addIssue({
          code: 'custom',
          path: ['expiresAt'],
          message: 'Hạn phản hồi không được ở quá khứ.',
        });
      } else if (value.startDate && value.expiresAt > value.startDate) {
        context.addIssue({
          code: 'custom',
          path: ['expiresAt'],
          message: 'Hạn phản hồi không được sau ngày nhận việc.',
        });
      }
    }
  });

export type OfferValues = z.infer<typeof offerSchema>;

export function toOfferBody(values: OfferValues, mode: 'create' | 'edit') {
  const blank = mode === 'create' ? undefined : null;
  return {
    salary: Number(values.salary),
    startDate: values.startDate,
    expiresAt: values.expiresAt === '' ? blank : values.expiresAt,
    note: values.note === '' ? blank : values.note,
  };
}

/** An offer whose answer deadline is before today can still be declined, not accepted. */
export function isOfferExpired(
  expiresAt: string | null,
  now: Date = new Date(),
) {
  return expiresAt !== null && expiresAt.slice(0, 10) < todayText(now);
}
