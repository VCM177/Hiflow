'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { KeyRound, Lock, LockOpen, Pencil, UserRoundCog } from 'lucide-react';
import { USER_ROLE_LABEL, UserRole } from '@hiflow/shared-types';
import { z } from 'zod';

import { DataTable, type DataColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterToolbar } from '@/components/shared/filter-toolbar';
import { IconButton } from '@/components/shared/icon-button';
import { ListPagination } from '@/components/shared/list-pagination';
import { PageSizeSelector } from '@/components/shared/page-size-selector';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDepartmentOptions } from '@/features/catalogs/options';
import { useListParams } from '@/hooks/use-list-params';
import { formatDate } from '@/lib/format';
import { listBaseShape } from '@/lib/list-params';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  ACCOUNT_STATE_MAP,
  ROLE_OPTIONS,
  USER_ACTION_PERMISSIONS as PERMISSION,
  USER_SORT_KEYS,
  isUserRole,
} from './constants';
import { fetchUsers, type UserRow } from './user-api';
import { rowRules } from './user-rules';

const ALL = 'all';

// A module constant: `useListParams` needs a stable schema object.
const LIST_SHAPE = {
  ...listBaseShape,
  sortBy: z.enum(USER_SORT_KEYS).catch('createdAt'),
  sortDir: z.enum(['asc', 'desc']).catch('desc'),
  role: z.string().refine(isUserRole).optional().catch(undefined),
  departmentId: z.string().uuid().optional().catch(undefined),
  isActive: z.enum(['true', 'false']).optional().catch(undefined),
};

export interface UserRowActions {
  onEdit: (user: UserRow) => void;
  onChangeRole: (user: UserRow) => void;
  onToggleActive: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
}

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (next: string | undefined) => void;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : next)}
    >
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const STATE_OPTIONS = [
  { value: 'true', label: ACCOUNT_STATE_MAP.active.label },
  { value: 'false', label: ACCOUNT_STATE_MAP.locked.label },
];

export function UserTable({
  actions,
  onCreate,
}: {
  actions: UserRowActions;
  onCreate: () => void;
}) {
  const session = useSession();
  const departments = useDepartmentOptions();
  const { params, setParams, resetFilters, hasActiveFilters } =
    useListParams(LIST_SHAPE);
  const { page, limit, search, sortBy, sortDir, role, departmentId, isActive } =
    params;

  const request = {
    page,
    limit,
    search,
    sortBy,
    sortDir,
    role: role as UserRole | undefined,
    departmentId,
    isActive: isActive === undefined ? undefined : isActive === 'true',
  };
  const query = useQuery({
    queryKey: queryKeys.list('user', request),
    queryFn: ({ signal }) => fetchUsers(request, signal),
    placeholderData: keepPreviousData,
  });

  const columns: DataColumn<UserRow>[] = [
    {
      id: 'fullName',
      header: 'Họ và tên',
      sortKey: 'fullName',
      cell: (user) => <span className="font-medium">{user.fullName}</span>,
    },
    { id: 'email', header: 'Email', sortKey: 'email', cell: (u) => u.email },
    {
      id: 'role',
      header: 'Vai trò',
      sortKey: 'role',
      cell: (user) => USER_ROLE_LABEL[user.role] ?? user.role,
    },
    {
      id: 'department',
      header: 'Phòng ban',
      cell: (user) => user.departmentName ?? '—',
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (user) => (
        <StatusBadge
          status={user.isActive ? 'active' : 'locked'}
          map={ACCOUNT_STATE_MAP}
        />
      ),
    },
    {
      id: 'createdAt',
      header: 'Ngày tạo',
      sortKey: 'createdAt',
      cell: (user) => formatDate(user.createdAt),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      interactive: true,
      cell: (user) => {
        const rules = rowRules(session.user, user, user.isActive);
        // HR sees no actions on an Admin account.
        if (!rules.manageable) return null;
        return (
          <div className="flex gap-1">
            <PermissionGate permission={PERMISSION.update}>
              <IconButton
                label={`Sửa ${user.fullName}`}
                icon={Pencil}
                onClick={() => actions.onEdit(user)}
              />
            </PermissionGate>
            <PermissionGate
              permission={PERMISSION.role}
              disabledReason={rules.roleLocked}
            >
              <IconButton
                label={`Đổi vai trò của ${user.fullName}`}
                icon={UserRoundCog}
                onClick={() => actions.onChangeRole(user)}
              />
            </PermissionGate>
            <PermissionGate
              permission={PERMISSION.status}
              disabledReason={rules.statusLocked}
            >
              <IconButton
                label={
                  user.isActive
                    ? `Khóa ${user.fullName}`
                    : `Mở khóa ${user.fullName}`
                }
                icon={user.isActive ? Lock : LockOpen}
                onClick={() => actions.onToggleActive(user)}
              />
            </PermissionGate>
            <PermissionGate permission={PERMISSION.password}>
              <IconButton
                label={`Đặt lại mật khẩu của ${user.fullName}`}
                icon={KeyRound}
                onClick={() => actions.onResetPassword(user)}
              />
            </PermissionGate>
          </div>
        );
      },
    },
  ];

  const meta = query.data?.meta;

  return (
    <SectionCard flush>
      <div className="border-b border-hf-border p-4">
        <FilterToolbar
          search={search}
          onSearchChange={(next) => setParams({ search: next })}
          searchLabel="Tìm người dùng"
          searchPlaceholder="Tìm theo tên hoặc email"
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        >
          <FilterSelect
            label="Lọc theo vai trò"
            value={role}
            allLabel="Mọi vai trò"
            options={ROLE_OPTIONS}
            onChange={(next) => setParams({ role: next })}
          />
          <FilterSelect
            label="Lọc theo phòng ban"
            value={departmentId}
            allLabel="Mọi phòng ban"
            options={departments.options}
            onChange={(next) => setParams({ departmentId: next })}
          />
          <FilterSelect
            label="Lọc theo trạng thái"
            value={isActive}
            allLabel="Mọi trạng thái"
            options={STATE_OPTIONS}
            onChange={(next) => setParams({ isActive: next })}
          />
        </FilterToolbar>
      </div>
      <DataTable
        caption="Danh sách người dùng"
        columns={columns}
        rows={query.data?.items ?? []}
        getRowKey={(user) => user.id}
        sort={{
          sortBy,
          sortDir,
          onChange: (nextBy, nextDir) =>
            setParams({ sortBy: nextBy, sortDir: nextDir }),
        }}
        state={{
          isLoading: query.isPending,
          error: query.error,
          onRetry: () => void query.refetch(),
        }}
        empty={
          page > 1 ? (
            <EmptyState
              title="Trang này không còn dữ liệu"
              action={
                <Button onClick={() => setParams({ page: 1 })}>
                  Về trang đầu
                </Button>
              }
            />
          ) : hasActiveFilters ? (
            <EmptyState
              title="Không có kết quả"
              description="Không có người dùng nào khớp với bộ lọc hiện tại."
              action={<Button onClick={resetFilters}>Xóa bộ lọc</Button>}
            />
          ) : (
            <EmptyState
              title="Chưa có người dùng nào"
              description="Thêm người dùng đầu tiên để họ đăng nhập."
              action={
                <PermissionGate permission={PERMISSION.create}>
                  <Button variant="primary" onClick={onCreate}>
                    Thêm người dùng
                  </Button>
                </PermissionGate>
              }
            />
          )
        }
      />
      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hf-border p-4">
          <PageSizeSelector
            value={limit}
            onChange={(next) => setParams({ limit: next })}
          />
          <ListPagination
            meta={meta}
            onPageChange={(next) =>
              setParams({ page: next }, { keepPage: true })
            }
          />
        </div>
      )}
    </SectionCard>
  );
}
