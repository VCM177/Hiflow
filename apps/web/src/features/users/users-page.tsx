'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS, type UserRole } from '@hiflow/shared-types';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { ErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { NO_DEPARTMENT, USER_ACTION_PERMISSIONS } from './constants';
import {
  changeUserRole,
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  type UserRow,
} from './user-api';
import { CreateUserDialog, EditUserDialog } from './user-form-dialog';
import { ChangeRoleDialog, ResetPasswordDialog } from './user-security-dialogs';
import { UserTable } from './user-table';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: UserRow }
  | { kind: 'role'; user: UserRow }
  | { kind: 'status'; user: UserRow }
  | { kind: 'password'; user: UserRow };

/**
 * The Người dùng screen. One dialog is open at a time; `open` is kept apart from `dialog`
 * so the text does not change while the dialog fades out, and `key` gives each opening a
 * form that starts from the row it was opened on.
 */
export function UsersPage() {
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<(Dialog & { key: number }) | null>(
    null,
  );
  const [open, setOpen] = React.useState(false);

  if (!can(PERMISSIONS.user.listView)) {
    return <ErrorView kind="forbidden" />;
  }

  function show(next: Dialog) {
    setDialog((current) => ({ ...next, key: (current?.key ?? 0) + 1 }));
    setOpen(true);
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.entity('user') });
  }

  const actions = {
    onEdit: (user: UserRow) => show({ kind: 'edit', user }),
    onChangeRole: (user: UserRow) => show({ kind: 'role', user }),
    onToggleActive: (user: UserRow) => show({ kind: 'status', user }),
    onResetPassword: (user: UserRow) => show({ kind: 'password', user }),
  };
  const onOpenChange = (next: boolean) => setOpen(next);
  const departmentOrNull = (value: string) =>
    value === NO_DEPARTMENT ? null : value;

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Tài khoản đăng nhập, vai trò và phòng ban."
        actions={
          <PermissionGate permission={USER_ACTION_PERMISSIONS.create}>
            <Button variant="primary" onClick={() => show({ kind: 'create' })}>
              Thêm người dùng
            </Button>
          </PermissionGate>
        }
      />
      <UserTable actions={actions} onCreate={() => show({ kind: 'create' })} />

      {dialog?.kind === 'create' && (
        <CreateUserDialog
          key={dialog.key}
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={async (values) => {
            await createUser({
              ...values,
              role: values.role as UserRole,
              departmentId: departmentOrNull(values.departmentId) ?? undefined,
            });
            await refresh();
            toast.success(`Đã thêm ${values.fullName}`);
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EditUserDialog
          key={dialog.key}
          user={dialog.user}
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={async (values) => {
            await updateUser(dialog.user.id, {
              fullName: values.fullName,
              departmentId: departmentOrNull(values.departmentId),
            });
            await refresh();
            toast.success(`Đã lưu ${values.fullName}`);
          }}
        />
      )}
      {dialog?.kind === 'role' && (
        <ChangeRoleDialog
          key={dialog.key}
          user={dialog.user}
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={async (values) => {
            await changeUserRole(dialog.user.id, values.role as UserRole);
            await refresh();
            toast.success(`Đã đổi vai trò của ${dialog.user.fullName}`);
          }}
        />
      )}
      {dialog?.kind === 'password' && (
        <ResetPasswordDialog
          key={dialog.key}
          user={dialog.user}
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={async (values) => {
            await resetUserPassword(dialog.user.id, values.newPassword);
            toast.success(`Đã đặt lại mật khẩu của ${dialog.user.fullName}`);
          }}
        />
      )}
      {dialog?.kind === 'status' && (
        <ConfirmDialog
          key={dialog.key}
          open={open}
          onOpenChange={onOpenChange}
          title={dialog.user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
          description={
            dialog.user.isActive
              ? `${dialog.user.fullName} sẽ không đăng nhập được nữa, và phiên đang mở bị kết thúc ở lần thao tác kế tiếp.`
              : `${dialog.user.fullName} sẽ đăng nhập lại được.`
          }
          confirmLabel={dialog.user.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
          onConfirm={async () => {
            await setUserActive(dialog.user.id, !dialog.user.isActive);
            await refresh();
            toast.success(
              dialog.user.isActive
                ? `Đã khóa ${dialog.user.fullName}`
                : `Đã mở khóa ${dialog.user.fullName}`,
            );
          }}
        />
      )}
    </>
  );
}
