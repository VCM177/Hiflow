import {
  JOB_STATUS_LABEL,
  JobStatus,
  PERMISSIONS,
  type Permission,
} from '@hiflow/shared-types';

import type { StatusMap } from '@/components/shared/status-badge';

export const JOB_STATUS_MAP: StatusMap<JobStatus> = {
  [JobStatus.DRAFT]: {
    label: JOB_STATUS_LABEL[JobStatus.DRAFT],
    variant: 'neutral',
  },
  [JobStatus.OPEN]: {
    label: JOB_STATUS_LABEL[JobStatus.OPEN],
    variant: 'success',
  },
  [JobStatus.CLOSED]: {
    label: JOB_STATUS_LABEL[JobStatus.CLOSED],
    variant: 'neutral',
  },
};

export const JOB_STATUS_OPTIONS = Object.values(JobStatus).map((status) => ({
  value: status,
  label: JOB_STATUS_LABEL[status],
}));

export function isJobStatus(value: unknown): value is JobStatus {
  return (
    typeof value === 'string' &&
    (Object.values(JobStatus) as string[]).includes(value)
  );
}

/** The columns the API lets the job list sort by (`ListJobsQueryDto.sortBy`). */
export const JOB_SORT_KEYS = [
  'title',
  'status',
  'quantity',
  'createdAt',
  'publishedAt',
] as const;

export type JobAction = 'edit' | 'publish' | 'stop' | 'delete';

const P = PERMISSIONS.job;

export const JOB_ACTION_PERMISSION: Record<JobAction, Permission> = {
  edit: P.update,
  publish: P.publish,
  stop: P.stop,
  delete: P.delete,
};

const ACTIONS_BY_STATUS: Record<JobStatus, readonly JobAction[]> = {
  [JobStatus.DRAFT]: ['edit', 'publish', 'delete'],
  [JobStatus.OPEN]: ['edit', 'stop'],
  // A closed job cannot be edited (the API answers 409).
  [JobStatus.CLOSED]: [],
};

/** What can be done to a job in this status, before permissions are looked at. */
export function jobActionsFor(status: JobStatus): readonly JobAction[] {
  return ACTIONS_BY_STATUS[status] ?? [];
}
