import { InterviewResult, UserRole } from '@hiflow/shared-types';

export const INTERVIEW_RESULT_LABEL: Readonly<Record<InterviewResult, string>> =
  {
    [InterviewResult.PENDING]: 'Chờ kết quả',
    [InterviewResult.PASSED]: 'Đạt',
    [InterviewResult.FAILED]: 'Không đạt',
    [InterviewResult.CANCELLED]: 'Đã hủy',
  };

/** Roles that can sit on an interview panel. */
export const INTERVIEWER_ROLES: readonly UserRole[] = [
  UserRole.INTERVIEWER,
  UserRole.DEPT_MANAGER,
  UserRole.HR_MANAGER,
];

/** An interview blocks its interviewer for this long. */
export const INTERVIEW_SLOT_MINUTES = 60;

export const MAX_ROUND = 10;

export const RACE_MESSAGE =
  'Lịch phỏng vấn vừa được xử lý bởi người khác, vui lòng tải lại';
