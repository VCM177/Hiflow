export enum RequisitionStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum ApplicationStatus {
  NEW = 'NEW',
  SCREENING = 'SCREENING',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/**
 * While a candidate has an application in any of these statuses their data must
 * stay: it is still being processed, or they were hired. Only a rejected or
 * withdrawn application lets the data be anonymised.
 */
export const APPLICATION_HOLD_STATUSES: readonly ApplicationStatus[] =
  Object.values(ApplicationStatus).filter(
    (status) =>
      status !== ApplicationStatus.REJECTED &&
      status !== ApplicationStatus.WITHDRAWN,
  );

export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum InterviewResult {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum CandidateSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  SOCIAL = 'SOCIAL',
  AGENCY = 'AGENCY',
  OTHER = 'OTHER',
}
