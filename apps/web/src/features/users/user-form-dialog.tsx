'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useDepartmentOptions } from '@/features/catalogs/options';

import { NO_DEPARTMENT, grantableRoleOptions } from './constants';
import {
  createUserSchema,
  editUserSchema,
  type CreateUserValues,
  type EditUserValues,
} from './user-schema';
import type { UserRow } from './user-api';
import { useSession } from '@/providers/session-provider';

const NO_DEPARTMENT_OPTION = {
  value: NO_DEPARTMENT,
  label: 'Không thuộc phòng ban nào',
};

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Create an account: email, name, role, department and a first password. */
export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
}: DialogProps & { onSubmit: (values: CreateUserValues) => Promise<void> }) {
  const { user } = useSession();
  const departments = useDepartmentOptions();
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: '',
      departmentId: NO_DEPARTMENT,
      password: '',
    },
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Thêm người dùng"
      description="Người dùng đăng nhập bằng email và mật khẩu đầu tiên này."
      submitLabel="Thêm người dùng"
      form={form}
      onSubmit={onSubmit}
    >
      <RHFTextField
        control={form.control}
        name="email"
        label="Email"
        required
        inputProps={{ type: 'email', maxLength: 150, autoComplete: 'off' }}
      />
      <RHFTextField
        control={form.control}
        name="fullName"
        label="Họ và tên"
        required
        inputProps={{ maxLength: 100, autoComplete: 'off' }}
      />
      <RHFSelectField
        control={form.control}
        name="role"
        label="Vai trò"
        required
        selectProps={{
          options: grantableRoleOptions(user.role),
          placeholder: 'Chọn vai trò',
        }}
      />
      <RHFSelectField
        control={form.control}
        name="departmentId"
        label="Phòng ban"
        selectProps={{
          options: [NO_DEPARTMENT_OPTION, ...departments.options],
        }}
      />
      <RHFTextField
        control={form.control}
        name="password"
        label="Mật khẩu"
        required
        hint="8 đến 72 ký tự, có ít nhất một chữ cái và một chữ số."
        inputProps={{ type: 'password', autoComplete: 'new-password' }}
      />
    </FormDialog>
  );
}

/** Edit the name and the department of an account. Role and status have their own dialogs. */
export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
}: DialogProps & {
  user: UserRow;
  onSubmit: (values: EditUserValues) => Promise<void>;
}) {
  const departments = useDepartmentOptions();
  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: user.fullName,
      departmentId: user.departmentId ?? NO_DEPARTMENT,
    },
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sửa người dùng"
      description={user.email}
      submitLabel="Lưu thay đổi"
      form={form}
      onSubmit={onSubmit}
    >
      <RHFTextField
        control={form.control}
        name="fullName"
        label="Họ và tên"
        required
        inputProps={{ maxLength: 100, autoComplete: 'off' }}
      />
      <RHFSelectField
        control={form.control}
        name="departmentId"
        label="Phòng ban"
        selectProps={{
          options: [NO_DEPARTMENT_OPTION, ...departments.options],
        }}
      />
    </FormDialog>
  );
}
