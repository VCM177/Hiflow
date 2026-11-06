'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { RHFSelectField } from '@/components/shared/form/rhf-select-field';
import { RHFTextField } from '@/components/shared/form/rhf-text-field';
import { FormDialog } from '@/components/shared/form-dialog';
import { useSession } from '@/providers/session-provider';

import { grantableRoleOptions } from './constants';
import type { UserRow } from './user-api';
import {
  changeRoleSchema,
  resetPasswordSchema,
  type ChangeRoleValues,
  type ResetPasswordValues,
} from './user-schema';

interface DialogProps {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeRoleDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
}: DialogProps & { onSubmit: (values: ChangeRoleValues) => Promise<void> }) {
  const session = useSession();
  const form = useForm<ChangeRoleValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: { role: user.role },
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Đổi vai trò"
      description={`${user.fullName} sẽ có quyền theo vai trò mới ở lần thao tác kế tiếp.`}
      submitLabel="Đổi vai trò"
      form={form}
      onSubmit={onSubmit}
    >
      <RHFSelectField
        control={form.control}
        name="role"
        label="Vai trò"
        required
        selectProps={{ options: grantableRoleOptions(session.user.role) }}
      />
    </FormDialog>
  );
}

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
}: DialogProps & {
  onSubmit: (values: ResetPasswordValues) => Promise<void>;
}) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '' },
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Đặt lại mật khẩu"
      description={`Đặt mật khẩu mới cho ${user.fullName}. Hãy báo mật khẩu này cho họ qua kênh an toàn.`}
      submitLabel="Đặt lại mật khẩu"
      form={form}
      onSubmit={onSubmit}
    >
      <RHFTextField
        control={form.control}
        name="newPassword"
        label="Mật khẩu mới"
        required
        hint="8 đến 72 ký tự, có ít nhất một chữ cái và một chữ số."
        inputProps={{ type: 'password', autoComplete: 'new-password' }}
      />
    </FormDialog>
  );
}
