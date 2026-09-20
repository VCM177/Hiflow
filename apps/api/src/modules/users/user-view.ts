import { UserRole } from '@hiflow/shared-types';
import { User } from './entities/user.entity';

/** What the API exposes of a user; the password hash never leaves the server. */
export interface UserView {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  createdAt: Date;
}

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
