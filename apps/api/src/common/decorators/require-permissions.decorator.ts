import { Permission } from '@hiflow/shared-types';
import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * The caller must hold every listed permission (an admin's `*` satisfies all).
 * Documented as a 403 so the web app knows to show a "no access" message.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    ApiForbiddenResponse({
      description: 'Vai trò hiện tại không có quyền này',
    }),
  );
