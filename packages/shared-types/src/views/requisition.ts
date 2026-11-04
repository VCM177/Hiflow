import type { RequisitionStatus } from '../statuses';
import type { NamedRef } from './ref';

export interface RequisitionView {
  id: string;
  code: string;
  title: string;
  department: NamedRef | null;
  position: NamedRef | null;
  quantity: number;
  reason: string | null;
  expectedStartDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  status: RequisitionStatus;
  createdBy: NamedRef | null;
  approvedBy: NamedRef | null;
  approvedAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisitionEvent {
  id: string;
  event: string;
  actor: NamedRef | null;
  note: string | null;
  at: Date;
}
