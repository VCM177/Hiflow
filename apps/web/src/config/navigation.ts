import {
  BookOpen,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  UserRound,
  Users,
  BarChart3,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@hiflow/shared-types';

import { can } from '@/lib/permissions';

export interface NavItem {
  label: string;
  /** Path only; the query of a landing page is not part of a menu entry. */
  href: string;
  icon: LucideIcon;
  /** The menu reads permissions, never role names. */
  permission: Permission;
}

export interface NavGroup {
  id: 'main' | 'settings';
  label: string;
  items: readonly NavItem[];
}

const P = PERMISSIONS;

// docs/web-plan-detail.md table 2.1. Order is the order on screen.
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'main',
    label: 'Chính',
    items: [
      {
        label: 'Tổng quan',
        href: '/',
        icon: LayoutDashboard,
        permission: P.dashboard.overviewView,
      },
      {
        label: 'Yêu cầu tuyển dụng',
        href: '/requisitions',
        icon: ClipboardList,
        permission: P.requisition.listView,
      },
      {
        label: 'Tin tuyển dụng',
        href: '/jobs',
        icon: Briefcase,
        permission: P.job.listView,
      },
      {
        label: 'Ứng viên',
        href: '/candidates',
        icon: UserRound,
        permission: P.candidate.listView,
      },
      {
        label: 'Hồ sơ ứng tuyển',
        href: '/applications',
        icon: FileText,
        permission: P.application.listView,
      },
      {
        label: 'Lịch phỏng vấn',
        href: '/interviews',
        icon: CalendarClock,
        permission: P.interview.listView,
      },
      {
        label: 'Báo cáo',
        href: '/reports',
        icon: BarChart3,
        permission: P.report.overviewView,
      },
    ],
  },
  {
    id: 'settings',
    label: 'Thiết lập',
    items: [
      {
        label: 'Người dùng',
        href: '/users',
        icon: Users,
        permission: P.user.listView,
      },
      // Only the Admin may create departments, so that is the permission that opens the catalogs.
      {
        label: 'Danh mục',
        href: '/catalogs',
        icon: BookOpen,
        permission: P.department.create,
      },
      {
        label: 'Nhật ký kiểm toán',
        href: '/audit-events',
        icon: ScrollText,
        permission: P.audit.eventView,
      },
    ],
  },
];

/** The groups with only the entries the user may open; a group with none is dropped. Hidden, never disabled. */
export function visibleNavGroups(granted: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(granted, item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** Whether the menu entry matches the current path. The home entry matches only `/`. */
export function isActiveNavItem(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
