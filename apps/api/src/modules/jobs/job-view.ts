import type { JobView, NamedRef } from '@hiflow/shared-types';
import { Job } from './entities/job.entity';

const ref = (
  entity: { id: string; name?: string; fullName?: string } | null | undefined,
): NamedRef | null =>
  entity ? { id: entity.id, name: entity.name ?? entity.fullName ?? '' } : null;

export const toJobView = (job: Job, applicationCount: number): JobView => ({
  id: job.id,
  requisition: job.requisition
    ? { id: job.requisition.id, code: job.requisition.code }
    : null,
  title: job.title,
  position: ref(job.position),
  department: ref(job.department),
  quantity: job.quantity,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  location: job.location,
  description: job.description,
  status: job.status,
  publishedAt: job.publishedAt,
  createdBy: ref(job.createdBy),
  applicationCount,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});
