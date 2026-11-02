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
