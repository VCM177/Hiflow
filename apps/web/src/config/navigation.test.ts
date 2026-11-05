import { ROLE_PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import { isActiveNavItem, NAV_GROUPS, visibleNavGroups } from './navigation';

function labels(role: UserRole): string[] {
  return visibleNavGroups(ROLE_PERMISSIONS[role]).flatMap((group) =>
    group.items.map((item) => item.label),
  );
}

// docs/web-plan-detail.md table 2.1, who sees which entry.
describe('visibleNavGroups', () => {
  it('shows the Admin everything', () => {
    expect(labels(UserRole.ADMIN)).toEqual([
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
      'Báo cáo',
      'Người dùng',
      'Danh mục',
      'Nhật ký kiểm toán',
    ]);
  });

  it('shows HR the work menus and users, but not catalogs or the audit log', () => {
    expect(labels(UserRole.HR_MANAGER)).toEqual([
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
      'Báo cáo',
      'Người dùng',
    ]);
  });

  it('shows a department manager their requisitions, jobs, applications and interviews', () => {
    expect(labels(UserRole.DEPT_MANAGER)).toEqual([
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
    ]);
  });

  it('shows a recruiter the pipeline but no reports or settings', () => {
    expect(labels(UserRole.RECRUITER)).toEqual([
      'Tổng quan',
      'Yêu cầu tuyển dụng',
      'Tin tuyển dụng',
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
    ]);
  });

  it('shows an interviewer only candidates, applications and interviews', () => {
    expect(labels(UserRole.INTERVIEWER)).toEqual([
      'Ứng viên',
      'Hồ sơ ứng tuyển',
      'Lịch phỏng vấn',
    ]);
  });

  it('drops a group that has no entry left', () => {
    const groups = visibleNavGroups(ROLE_PERMISSIONS[UserRole.INTERVIEWER]);
    expect(groups.map((group) => group.id)).toEqual(['main']);
  });

  it('shows nothing to someone with no permission', () => {
    expect(visibleNavGroups([])).toEqual([]);
  });

  it('reads permissions, so a custom grant opens exactly its entry', () => {
    expect(
      visibleNavGroups(['audit.event.view']).flatMap((g) =>
        g.items.map((i) => i.label),
      ),
    ).toEqual(['Nhật ký kiểm toán']);
  });

  it('has unique paths', () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('isActiveNavItem', () => {
  it('matches the home entry only on /', () => {
    expect(isActiveNavItem('/', '/')).toBe(true);
    expect(isActiveNavItem('/', '/jobs')).toBe(false);
  });

  it('matches an entry and the pages under it', () => {
    expect(isActiveNavItem('/jobs', '/jobs')).toBe(true);
    expect(isActiveNavItem('/jobs', '/jobs/12/edit')).toBe(true);
  });

  it('does not match a path that only starts with the same letters', () => {
    expect(isActiveNavItem('/jobs', '/jobsite')).toBe(false);
  });
});
