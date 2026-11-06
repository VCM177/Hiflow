import { z } from 'zod';

import {
  consentSchema,
  cvFileError,
  emailSchema,
  phoneSchema,
  publicFullNameSchema,
} from '@/lib/validations';

// The public application form (docs/web-plan-detail.md 1.6). The API repeats every rule.
export const applicationSchema = z.object({
  fullName: publicFullNameSchema,
  email: z
    .string()
    .trim()
    .min(1, { error: 'Vui lòng nhập email.' })
    .pipe(emailSchema),
  phone: z
    .string()
    .trim()
    .min(1, { error: 'Vui lòng nhập số điện thoại.' })
    .pipe(phoneSchema),
  cv: z
    .custom<File | null>((value) => value === null || value instanceof File)
    .superRefine((file, context) => {
      const message = file
        ? cvFileError(file)
        : 'Vui lòng chọn tệp CV (PDF hoặc DOCX).';
      if (message) context.addIssue({ code: 'custom', message });
    }),
  consent: z.boolean().pipe(consentSchema),
});

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationOutput = z.output<typeof applicationSchema>;

/** The multipart body the API expects; the CV goes under `cv`, the captcha token as text. */
export function buildApplicationBody(
  values: ApplicationOutput,
  turnstileToken: string | null,
): FormData {
  const body = new FormData();
  body.set('fullName', values.fullName);
  body.set('email', values.email);
  body.set('phone', values.phone);
  body.set('consent', String(values.consent));
  if (turnstileToken) body.set('turnstileToken', turnstileToken);
  if (values.cv) body.set('cv', values.cv);
  return body;
}
