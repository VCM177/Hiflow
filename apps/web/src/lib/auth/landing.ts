import { PERMISSIONS } from '@hiflow/shared-types';

import { can } from '@/lib/permissions';

/**
 * Where a user lands after signing in with no page asked for. Whoever may see the
 * dashboard starts there; an interviewer has no dashboard and starts on the
 * interviews that still await their result.
 */
export function landingPathFor(permissions: readonly string[]): string {
  return can(permissions, PERMISSIONS.dashboard.overviewView)
    ? '/'
    : '/interviews?result=PENDING';
}
