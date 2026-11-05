import { hasPermission, type Permission } from '@hiflow/shared-types';

/**
 * Whether the granted permission list allows `required`. The Admin wildcard ('*')
 * allows everything. The API is the real gate; the UI uses this only to hide or
 * disable controls the user could never use.
 */
export function can(granted: readonly string[], required: Permission): boolean {
  return hasPermission(granted, required);
}

/** True when the list allows at least one of `required`. */
export function canAny(
  granted: readonly string[],
  required: readonly Permission[],
): boolean {
  return required.some((permission) => can(granted, permission));
}
