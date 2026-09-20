import { RequisitionStatus } from '@hiflow/shared-types';
import { Requisition } from './entities/requisition.entity';

interface Ref {
  id: string;
  name: string;
}

export interface RequisitionView {
  id: string;
  code: string;
  title: string;
  department: Ref | null;
  position: Ref | null;
  quantity: number;
  reason: string | null;
  expectedStartDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  status: RequisitionStatus;
  createdBy: Ref | null;
  approvedBy: Ref | null;
  approvedAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ref = (
  entity: { id: string; name?: string; fullName?: string } | null | undefined,
): Ref | null =>
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

export interface RequisitionEvent {
  id: string;
  event: string;
  actor: Ref | null;
  note: string | null;
  at: Date;
}
