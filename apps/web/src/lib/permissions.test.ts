import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  UserRole,
  permissionsForRole,
} from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import { can, canAny } from './permissions';

describe('can', () => {
  it('lets the Admin wildcard do anything', () => {
    expect(can([ALL_PERMISSIONS], PERMISSIONS.job.listView)).toBe(true);
  });

  it('allows a permission that is in the list', () => {
    expect(can([PERMISSIONS.job.listView], PERMISSIONS.job.listView)).toBe(
      true,
    );
  });

  it('refuses a permission that is missing from the list', () => {
    expect(can([PERMISSIONS.job.listView], PERMISSIONS.job.create)).toBe(false);
    expect(can([], PERMISSIONS.job.listView)).toBe(false);
  });

  it('agrees with the role table for an interviewer and a recruiter', () => {
    const interviewer = permissionsForRole(UserRole.INTERVIEWER);
    expect(can(interviewer, PERMISSIONS.interview.resultRecord)).toBe(true);
    expect(can(interviewer, PERMISSIONS.job.create)).toBe(false);
  });
});

describe('canAny', () => {
  it('is true when one of the permissions is granted', () => {
    expect(
      canAny(
        [PERMISSIONS.job.listView],
        [PERMISSIONS.interview.resultRecord, PERMISSIONS.job.listView],
      ),
    ).toBe(true);
  });

  it('is false when none is granted', () => {
    expect(canAny([], [PERMISSIONS.job.listView])).toBe(false);
  });
});
