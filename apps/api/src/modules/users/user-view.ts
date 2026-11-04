import type { UserOption, UserView } from '@hiflow/shared-types';
import { User } from './entities/user.entity';

export const toUserView = (user: User): UserView => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  departmentId: user.departmentId,
  departmentName: user.department?.name ?? null,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

export const toUserOption = (user: User): UserOption => ({
  id: user.id,
  fullName: user.fullName,
  role: user.role,
});
