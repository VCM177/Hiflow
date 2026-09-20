import { UserRole } from '@hiflow/shared-types';
import { departmentScope, NO_DEPARTMENT_ID } from './scope';
import type { AuthUser } from './types/auth-user';

const actor = (role: UserRole, departmentId: string | null): AuthUser => ({
  id: 'u1',
  email: 'a@hiflow.local',
  fullName: 'A',
  role,
  departmentId,
  permissions: [],
});

describe('departmentScope', () => {
  it('confines a department manager to their own department', () => {
    expect(departmentScope(actor(UserRole.DEPT_MANAGER, 'dept-1'))).toBe(
      'dept-1',
    );
  });

  it('confines a department manager with no department to nothing at all', () => {
    expect(departmentScope(actor(UserRole.DEPT_MANAGER, null))).toBe(
      NO_DEPARTMENT_ID,
    );
  });

  it.each([
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
    UserRole.RECRUITER,
    UserRole.INTERVIEWER,
  ])('does not confine %s', (role) => {
    expect(departmentScope(actor(role, 'dept-1'))).toBeNull();
  });
});
