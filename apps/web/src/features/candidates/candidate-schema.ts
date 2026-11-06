import type { CandidateSource } from '@hiflow/shared-types';
import { z } from 'zod';

import {
  emailSchema,
  internalFullNameSchema,
  isOldEnough,
  phoneSchema,
} from '@/lib/validations';

import { isCandidateSource } from './constants';

/**
 * The candidate form. Every box holds text (a blank optional one is ''), so the values
 * stay the same type going in and coming out; `toCandidateBody` turns them into what the
 * API takes.
 */
export const candidateSchema = z.object({
  fullName: internalFullNameSchema,
  email: z
    .string()
    .trim()
    .min(1, { error: 'Vui lòng nhập email.' })
    .pipe(emailSchema),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || phoneSchema.safeParse(value).success, {
      error: 'Số điện thoại không hợp lệ.',
    }),
  dob: z
    .string()
    .trim()
    .refine((value) => value === '' || !Number.isNaN(Date.parse(value)), {
      error: 'Ngày sinh không hợp lệ.',
    })
    .refine(
      (value) =>
        value === '' ||
        Number.isNaN(Date.parse(value)) ||
        isOldEnough(new Date(value), new Date()),
      { error: 'Ứng viên phải từ 16 tuổi.' },
    ),
  source: z.string().refine((value): boolean => isCandidateSource(value), {
    error: 'Vui lòng chọn nguồn.',
  }),
  note: z.string().trim().max(2000, { error: 'Ghi chú tối đa 2000 ký tự.' }),
});

export type CandidateValues = z.infer<typeof candidateSchema>;

/** Create leaves blank optional fields out; an edit sends null so a cleared field is cleared. */
export function toCandidateBody(
  values: CandidateValues,
  mode: 'create' | 'edit',
) {
  const blank = mode === 'create' ? undefined : null;
  return {
    fullName: values.fullName,
    email: values.email,
    phone:
      values.phone === '' ? blank : (phoneSchema.parse(values.phone) as string),
    dob: values.dob === '' ? blank : values.dob,
    source: values.source as CandidateSource,
  };
}
