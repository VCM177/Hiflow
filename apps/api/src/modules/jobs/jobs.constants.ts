import { JobStatus } from '@hiflow/shared-types';

export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  [JobStatus.DRAFT]: 'Nháp',
  [JobStatus.OPEN]: 'Đang tuyển',
  [JobStatus.CLOSED]: 'Đã đóng',
};
