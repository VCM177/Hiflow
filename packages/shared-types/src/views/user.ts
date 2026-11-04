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

/** The few fields needed to pick a person in a form; no contact details. */
export interface UserOption {
  id: string;
  fullName: string;
  role: UserRole;
}
