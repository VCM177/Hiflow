import { z } from 'zod';

import { internalFullNameSchema, passwordSchema } from '@/lib/validations';

export const profileNameSchema = z.object({ fullName: internalFullNameSchema });
export type ProfileNameValues = z.infer<typeof profileNameSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: 'Vui lòng nhập mật khẩu hiện tại.' }),
    newPassword: passwordSchema,
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    error: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    path: ['newPassword'],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
