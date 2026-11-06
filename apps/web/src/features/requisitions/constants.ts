import {
  PERMISSIONS,
  REQUISITION_STATUS_LABEL,
  RequisitionStatus,
  type Permission,
} from '@hiflow/shared-types';

import type { StatusMap } from '@/components/shared/status-badge';

export const REQUISITION_STATUS_MAP: StatusMap<RequisitionStatus> = {
  [RequisitionStatus.DRAFT]: {
    label: REQUISITION_STATUS_LABEL[RequisitionStatus.DRAFT],
    variant: 'neutral',
  },
  [RequisitionStatus.PENDING_APPROVAL]: {
    label: REQUISITION_STATUS_LABEL[RequisitionStatus.PENDING_APPROVAL],
    variant: 'warning',
  },
  [RequisitionStatus.APPROVED]: {
    label: REQUISITION_STATUS_LABEL[RequisitionStatus.APPROVED],
    variant: 'success',
  },
  [RequisitionStatus.REJECTED]: {
    label: REQUISITION_STATUS_LABEL[RequisitionStatus.REJECTED],
    variant: 'destructive',
  },
  [RequisitionStatus.CLOSED]: {
    label: REQUISITION_STATUS_LABEL[RequisitionStatus.CLOSED],
    variant: 'neutral',
  },
};

export const REQUISITION_STATUS_OPTIONS = Object.values(RequisitionStatus).map(
  (status) => ({ value: status, label: REQUISITION_STATUS_LABEL[status] }),
);

export function isRequisitionStatus(
  value: unknown,
): value is RequisitionStatus {
  return (
    typeof value === 'string' &&
    (Object.values(RequisitionStatus) as string[]).includes(value)
  );
}

/** The columns the API lets the list sort by (`ListRequisitionsQueryDto.sortBy`). */
export const REQUISITION_SORT_KEYS = [
  'code',
  'title',
  'quantity',
  'status',
  'createdAt',
] as const;

export type RequisitionAction =
  'edit' | 'delete' | 'submit' | 'approve' | 'reject' | 'createJob' | 'close';

const P = PERMISSIONS;

/** The permission each action needs. */
export const REQUISITION_ACTION_PERMISSION: Record<
  RequisitionAction,
  Permission
> = {
  edit: P.requisition.update,
  delete: P.requisition.delete,
  submit: P.requisition.submit,
  approve: P.requisition.approve,
  reject: P.requisition.reject,
  createJob: P.job.create,
  close: P.requisition.close,
};

const ACTIONS_BY_STATUS: Record<
  RequisitionStatus,
  readonly RequisitionAction[]
> = {
  [RequisitionStatus.DRAFT]: ['edit', 'delete', 'submit'],
  [RequisitionStatus.PENDING_APPROVAL]: ['approve', 'reject'],
  // A rejected requisition is edited and sent again.
  [RequisitionStatus.REJECTED]: ['edit', 'submit'],
  [RequisitionStatus.APPROVED]: ['createJob', 'close'],
  [RequisitionStatus.CLOSED]: [],
};

/** What can be done to a requisition in this status, before permissions are looked at. */
export function actionsFor(
  status: RequisitionStatus,
): readonly RequisitionAction[] {
  return ACTIONS_BY_STATUS[status] ?? [];
}

/** The history codes the API sends (`REQUISITION_` removed) in Vietnamese. */
export const REQUISITION_EVENT_LABEL: Record<string, string> = {
  CREATED: 'Tạo yêu cầu',
  UPDATED: 'Cập nhật nội dung',
  SUBMITTED: 'Gửi duyệt',
  APPROVED: 'Duyệt yêu cầu',
  REJECTED: 'Từ chối yêu cầu',
  CLOSED: 'Đóng yêu cầu',
};
