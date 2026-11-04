import type { NamedRef, RequisitionView } from '@hiflow/shared-types';
import { Requisition } from './entities/requisition.entity';

const ref = (
  entity: { id: string; name?: string; fullName?: string } | null | undefined,
): NamedRef | null =>
  entity ? { id: entity.id, name: entity.name ?? entity.fullName ?? '' } : null;

export const toRequisitionView = (r: Requisition): RequisitionView => ({
  id: r.id,
  code: r.code,
  title: r.title,
  department: ref(r.department),
  position: ref(r.position),
  quantity: r.quantity,
  reason: r.reason,
  expectedStartDate: r.expectedStartDate,
  budgetMin: r.budgetMin,
  budgetMax: r.budgetMax,
  status: r.status,
  createdBy: ref(r.createdBy),
  approvedBy: ref(r.approvedBy),
  approvedAt: r.approvedAt,
  rejectReason: r.rejectReason,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});
