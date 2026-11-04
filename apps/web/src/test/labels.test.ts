import {
  APPLICATION_STATUS_LABEL,
  ApplicationStatus,
  CandidateSource,
  INTERVIEW_RESULT_LABEL,
  InterviewResult,
  JOB_STATUS_LABEL,
  JobStatus,
  OFFER_STATUS_LABEL,
  OfferStatus,
  REQUISITION_STATUS_LABEL,
  RequisitionStatus,
  SOURCE_LABEL,
  USER_ROLE_LABEL,
  UserRole,
} from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

const cases = [
  ['requisition status', RequisitionStatus, REQUISITION_STATUS_LABEL],
  ['job status', JobStatus, JOB_STATUS_LABEL],
  ['application status', ApplicationStatus, APPLICATION_STATUS_LABEL],
  ['interview result', InterviewResult, INTERVIEW_RESULT_LABEL],
  ['offer status', OfferStatus, OFFER_STATUS_LABEL],
  ['candidate source', CandidateSource, SOURCE_LABEL],
  ['user role', UserRole, USER_ROLE_LABEL],
] as const;

describe('shared label maps', () => {
  it.each(cases)(
    'name every %s, with no stray entries',
    (_name, enumObject, labels) => {
      const values = Object.values(enumObject).sort();
      expect(Object.keys(labels).sort()).toEqual(values);
      for (const value of values) {
        expect(
          (labels as Record<string, string>)[value].trim().length,
        ).toBeGreaterThan(0);
      }
    },
  );
});
