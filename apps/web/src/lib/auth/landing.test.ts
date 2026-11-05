import { ROLE_PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import { landingPathFor } from './landing';

describe('landingPathFor', () => {
  it.each([
    UserRole.ADMIN,
    UserRole.HR_MANAGER,
    UserRole.DEPT_MANAGER,
    UserRole.RECRUITER,
  ])('starts %s on the dashboard', (role) => {
    expect(landingPathFor(ROLE_PERMISSIONS[role])).toBe('/');
  });

  it('starts an interviewer on the interviews awaiting a result', () => {
    expect(landingPathFor(ROLE_PERMISSIONS[UserRole.INTERVIEWER])).toBe(
      '/interviews?result=PENDING',
    );
  });

  it('decides from permissions, not from a role name', () => {
    expect(landingPathFor(['dashboard.overview.view'])).toBe('/');
    expect(landingPathFor([])).toBe('/interviews?result=PENDING');
  });
});
