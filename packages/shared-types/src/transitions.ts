import { ApplicationStatus, RequisitionStatus } from './statuses';

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export const REQUISITION_TRANSITIONS: TransitionMap<RequisitionStatus> = {
  [RequisitionStatus.DRAFT]: [RequisitionStatus.PENDING_APPROVAL],
  [RequisitionStatus.PENDING_APPROVAL]: [
    RequisitionStatus.APPROVED,
    RequisitionStatus.REJECTED,
  ],
  [RequisitionStatus.REJECTED]: [RequisitionStatus.PENDING_APPROVAL],
  [RequisitionStatus.APPROVED]: [RequisitionStatus.CLOSED],
  [RequisitionStatus.CLOSED]: [],
};

export const APPLICATION_TRANSITIONS: TransitionMap<ApplicationStatus> = {
  [ApplicationStatus.NEW]: [
    ApplicationStatus.SCREENING,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.SCREENING]: [
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.INTERVIEW]: [
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.OFFER]: [
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.HIRED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
};

export function canTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
): boolean {
  return map[from].includes(to);
}
