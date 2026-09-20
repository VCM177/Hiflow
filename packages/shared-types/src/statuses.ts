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
