import { UserRole } from './roles';

/** Permission keys follow `domain.entity.action`. */
export const PERMISSIONS = {
  user: {
    listView: 'user.list.view',
    create: 'user.account.create',
    update: 'user.account.update',
    roleAssign: 'user.role.assign',
    statusUpdate: 'user.status.update',
    passwordReset: 'user.password.reset',
  },
  department: {
    listView: 'department.list.view',
    create: 'department.item.create',
    update: 'department.item.update',
    delete: 'department.item.delete',
  },
  position: {
    listView: 'position.list.view',
    create: 'position.item.create',
    update: 'position.item.update',
    delete: 'position.item.delete',
  },
  requisition: {
    listView: 'requisition.list.view',
    create: 'requisition.item.create',
    update: 'requisition.item.update',
    delete: 'requisition.item.delete',
    submit: 'requisition.request.submit',
    approve: 'requisition.request.approve',
    reject: 'requisition.request.reject',
    close: 'requisition.request.close',
  },
  job: {
    listView: 'job.list.view',
    create: 'job.item.create',
    update: 'job.item.update',
    delete: 'job.item.delete',
    publish: 'job.posting.publish',
    stop: 'job.posting.stop',
  },
  candidate: {
    listView: 'candidate.list.view',
    create: 'candidate.item.create',
    update: 'candidate.item.update',
    delete: 'candidate.item.delete',
    cvManage: 'candidate.cv.manage',
    noteCreate: 'candidate.note.create',
  },
  application: {
    listView: 'application.list.view',
    create: 'application.item.create',
    delete: 'application.item.delete',
    assigneeUpdate: 'application.assignee.update',
    statusUpdate: 'application.status.update',
    noteCreate: 'application.note.create',
  },
  offer: {
    view: 'offer.item.view',
    create: 'offer.item.create',
    update: 'offer.item.update',
    responseRecord: 'offer.response.record',
  },
  interview: {
    listView: 'interview.list.view',
    create: 'interview.item.create',
    update: 'interview.item.update',
    cancel: 'interview.item.cancel',
    resultRecord: 'interview.result.record',
  },
  dashboard: {
    overviewView: 'dashboard.overview.view',
  },
  report: {
    overviewView: 'report.overview.view',
    overviewExport: 'report.overview.export',
  },
  activityLog: {
    listView: 'activity_log.list.view',
    listExport: 'activity_log.list.export',
  },
} as const;

type ValueOf<T> = T[keyof T];

export type Permission = ValueOf<{
  [D in keyof typeof PERMISSIONS]: ValueOf<(typeof PERMISSIONS)[D]>;
}>;

export const ALL_PERMISSIONS = '*' as const;

export type GrantedPermission = Permission | typeof ALL_PERMISSIONS;

const P = PERMISSIONS;

export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly GrantedPermission[]>
> = {
  [UserRole.ADMIN]: [ALL_PERMISSIONS],
  [UserRole.HR_MANAGER]: [
    P.user.listView,
    P.user.create,
    P.user.update,
    P.user.roleAssign,
    P.user.statusUpdate,
    P.user.passwordReset,
    P.department.listView,
    P.position.listView,
    P.requisition.listView,
    P.requisition.approve,
    P.requisition.reject,
    P.requisition.close,
    P.job.listView,
    P.candidate.listView,
    P.application.listView,
    P.interview.listView,
    P.dashboard.overviewView,
    P.report.overviewView,
    P.report.overviewExport,
  ],
  [UserRole.DEPT_MANAGER]: [
    P.department.listView,
    P.position.listView,
    P.requisition.listView,
    P.requisition.create,
    P.requisition.update,
    P.requisition.delete,
    P.requisition.submit,
    P.job.listView,
    P.application.listView,
    P.dashboard.overviewView,
  ],
  [UserRole.RECRUITER]: [
    P.department.listView,
    P.position.listView,
    P.requisition.listView,
    P.job.listView,
    P.job.create,
    P.job.update,
    P.job.delete,
    P.job.publish,
    P.job.stop,
    P.candidate.listView,
    P.candidate.create,
    P.candidate.update,
    P.candidate.delete,
    P.candidate.cvManage,
    P.candidate.noteCreate,
    P.application.listView,
    P.application.create,
    P.application.delete,
    P.application.assigneeUpdate,
    P.application.statusUpdate,
    P.application.noteCreate,
    P.offer.view,
    P.offer.create,
    P.offer.update,
    P.offer.responseRecord,
    P.interview.listView,
    P.interview.create,
    P.interview.update,
    P.interview.cancel,
    P.dashboard.overviewView,
  ],
  [UserRole.INTERVIEWER]: [
    P.candidate.listView,
    P.application.listView,
    P.interview.listView,
    P.interview.resultRecord,
  ],
};

export function permissionsForRole(
  role: UserRole,
): readonly GrantedPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  granted: readonly string[],
  required: Permission,
): boolean {
  return granted.includes(ALL_PERMISSIONS) || granted.includes(required);
}
