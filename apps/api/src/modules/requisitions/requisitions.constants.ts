import { RequisitionStatus } from '@hiflow/shared-types';

export const REQUISITION_STATUS_LABEL: Readonly<
  Record<RequisitionStatus, string>
> = {
  [RequisitionStatus.DRAFT]: 'Nháp',
  [RequisitionStatus.PENDING_APPROVAL]: 'Chờ duyệt',
  [RequisitionStatus.APPROVED]: 'Đã duyệt',
  [RequisitionStatus.REJECTED]: 'Bị từ chối',
  [RequisitionStatus.CLOSED]: 'Đã đóng',
};

export const REQUISITION_CODE_SEQUENCE = 'requisition_code_seq';

/** Maps "METHOD route" of a logged write to the event shown on the timeline. */
export const REQUISITION_EVENTS: Readonly<Record<string, string>> = {
  'POST /requisitions': 'CREATED',
  'PATCH /requisitions/:id': 'UPDATED',
  'DELETE /requisitions/:id': 'DELETED',
  'POST /requisitions/:id/submit': 'SUBMITTED',
  'POST /requisitions/:id/approve': 'APPROVED',
  'POST /requisitions/:id/reject': 'REJECTED',
  'POST /requisitions/:id/close': 'CLOSED',
};
