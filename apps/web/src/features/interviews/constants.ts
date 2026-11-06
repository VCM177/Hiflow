import { INTERVIEW_RESULT_LABEL, InterviewResult } from '@hiflow/shared-types';

export const INTERVIEW_RESULT_OPTIONS = Object.values(InterviewResult).map(
  (result) => ({ value: result, label: INTERVIEW_RESULT_LABEL[result] }),
);

export function isInterviewResult(value: unknown): value is InterviewResult {
  return (
    typeof value === 'string' &&
    (Object.values(InterviewResult) as string[]).includes(value)
  );
}

/** The columns the API lets the interview list sort by (`ListInterviewsQueryDto.sortBy`). */
export const INTERVIEW_SORT_KEYS = [
  'scheduledAt',
  'round',
  'result',
  'createdAt',
] as const;

/** The most rounds an application can have (`MAX_ROUND` in the API). */
export const MAX_ROUND = 10;
