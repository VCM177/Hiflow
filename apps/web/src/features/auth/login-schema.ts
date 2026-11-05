import { z } from 'zod';

import { emailSchema } from '@/lib/validations';

// The password is only checked for being present: accounts made before today's
// password rules must still be able to sign in. The API decides if it is right.
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'Vui lòng nhập email.' })
    .pipe(emailSchema),
  password: z.string().min(1, { error: 'Vui lòng nhập mật khẩu.' }),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
