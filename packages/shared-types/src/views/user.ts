import type { UserRole } from '../roles';

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

/** Who the caller is choosing a person for (`GET /users/options?purpose=`). */
export const USER_OPTION_PURPOSE = {
  ASSIGNEE: 'ASSIGNEE',
  INTERVIEWER: 'INTERVIEWER',
} as const;
export type UserOptionPurpose =
  (typeof USER_OPTION_PURPOSE)[keyof typeof USER_OPTION_PURPOSE];
export const USER_OPTION_PURPOSES: readonly UserOptionPurpose[] =
  Object.values(USER_OPTION_PURPOSE);

/** The few fields needed to pick a person in a form; no contact details. */
export interface UserOption {
  id: string;
  fullName: string;
  role: UserRole;
}
