import { JobStatus } from '@hiflow/shared-types';
import { Job } from './entities/job.entity';

interface Ref {
  id: string;
  name: string;
}

export interface JobView {
  id: string;
  requisition: { id: string; code: string } | null;
  title: string;
  position: Ref | null;
  department: Ref | null;
  quantity: number;
  salaryMin: number | null;
  salaryMax: number | null;
  location: string | null;
  description: string | null;
  status: JobStatus;
  publishedAt: Date | null;
  createdBy: Ref | null;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ref = (
  entity: { id: string; name?: string; fullName?: string } | null | undefined,
): Ref | null =>
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
