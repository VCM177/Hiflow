import {
  PERMISSIONS,
  permissionsForRole,
  UserRole,
} from '@hiflow/shared-types';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AuthUser } from '../types/auth-user';
import { PermissionsGuard } from './permissions.guard';

// `this: void` lets the guard read these as bare handlers without tripping
// @typescript-eslint/unbound-method.
class SampleController {
  open(this: void) {}

  @RequirePermissions(PERMISSIONS.requisition.approve)
  approve(this: void) {}

  @RequirePermissions(PERMISSIONS.job.create, PERMISSIONS.job.publish)
  createAndPublish(this: void) {}
}

const userWithRole = (role: UserRole): AuthUser => ({
  id: 'u1',
  email: `${role.toLowerCase()}@hiflow.local`,
  fullName: role,
  role,
  departmentId: null,
  permissions: permissionsForRole(role),
});

const contextFor = (handler: () => void, user?: AuthUser): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new SampleController();

  it('lets a route without @RequirePermissions through', () => {
    expect(guard.canActivate(contextFor(controller.open))).toBe(true);
  });

  it.each([
    [UserRole.HR_MANAGER, true],
    [UserRole.ADMIN, true],
    [UserRole.RECRUITER, false],
    [UserRole.DEPT_MANAGER, false],
    [UserRole.INTERVIEWER, false],
  ])('%s approving a requisition -> allowed: %s', (role, allowed) => {
    const context = contextFor(controller.approve, userWithRole(role));

    if (allowed) {
      expect(guard.canActivate(context)).toBe(true);
    } else {
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    }
  });

  it('requires every listed permission, not just one', () => {
    const recruiter = contextFor(
      controller.createAndPublish,
      userWithRole(UserRole.RECRUITER),
    );
    const deptManager = contextFor(
      controller.createAndPublish,
      userWithRole(UserRole.DEPT_MANAGER),
    );

    expect(guard.canActivate(recruiter)).toBe(true);
    expect(() => guard.canActivate(deptManager)).toThrow(ForbiddenException);
  });

  it('forbids a guarded route when no user is attached', () => {
    expect(() =>
      guard.canActivate(contextFor(controller.approve, undefined)),
    ).toThrow(ForbiddenException);
  });
});
