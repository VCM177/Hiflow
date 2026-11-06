import { UserRole } from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import { grantableRoleOptions } from './constants';
import { rowRules } from './user-rules';

const admin = { id: 'a', role: UserRole.ADMIN };
const hr = { id: 'h', role: UserRole.HR_MANAGER };

describe('rowRules', () => {
  it('lets an Admin manage anyone', () => {
    expect(
      rowRules(admin, { id: 'x', role: UserRole.ADMIN }, true).manageable,
    ).toBe(true);
  });

  it('hides actions on an Admin account from HR', () => {
    expect(
      rowRules(hr, { id: 'a', role: UserRole.ADMIN }, true).manageable,
    ).toBe(false);
    expect(
      rowRules(hr, { id: 'r', role: UserRole.RECRUITER }, true).manageable,
    ).toBe(true);
  });

  it('locks role change and locking for the own account, with reasons', () => {
    const rules = rowRules(admin, admin, true);
    expect(rules.roleLocked).toContain('vai trò');
    expect(rules.statusLocked).toContain('khóa');
  });

  it('leaves other accounts open', () => {
    const rules = rowRules(admin, { id: 'x', role: UserRole.RECRUITER }, true);
    expect(rules.roleLocked).toBeUndefined();
    expect(rules.statusLocked).toBeUndefined();
  });
});

describe('grantableRoleOptions', () => {
  it('offers every role to an Admin', () => {
    expect(grantableRoleOptions(UserRole.ADMIN)).toHaveLength(5);
  });
  it('leaves Admin out for everyone else', () => {
    const values = grantableRoleOptions(UserRole.HR_MANAGER).map(
      (o) => o.value,
    );
    expect(values).not.toContain(UserRole.ADMIN);
    expect(values).toHaveLength(4);
  });
});
