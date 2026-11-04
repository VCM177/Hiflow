import { UserRole } from '@hiflow/shared-types';

/** Roles that can own an application (be its recruiter in charge). */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  UserRole.RECRUITER,
  UserRole.HR_MANAGER,
  UserRole.ADMIN,
];

export const RACE_MESSAGE =
  'Hồ sơ vừa được xử lý bởi người khác, vui lòng tải lại';
