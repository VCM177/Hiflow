import { z } from 'zod';

import {
  emailSchema,
  internalFullNameSchema,
  passwordSchema,
} from '@/lib/validations';

import { isUserRole } from './constants';

const roleSchema = z.string().refine((value): boolean => isUserRole(value), {
  error: 'Vui lòng chọn vai trò.',
});

/** Create: all five fields; the department is optional ('none' when blank). */
export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'Vui lòng nhập email.' })
    .pipe(emailSchema),
  fullName: internalFullNameSchema,
  role: roleSchema,
  departmentId: z.string(),
  password: passwordSchema,
});
export type CreateUserValues = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  fullName: internalFullNameSchema,
  departmentId: z.string(),
});
export type EditUserValues = z.infer<typeof editUserSchema>;

export const changeRoleSchema = z.object({ role: roleSchema });
export type ChangeRoleValues = z.infer<typeof changeRoleSchema>;

export const resetPasswordSchema = z.object({ newPassword: passwordSchema });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
