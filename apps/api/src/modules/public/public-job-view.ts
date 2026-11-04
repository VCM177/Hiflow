import type { PublicJobView } from '@hiflow/shared-types';
import { Job } from '../jobs/entities/job.entity';

export const toPublicJobView = (job: Job): PublicJobView => ({
  id: job.id,
  title: job.title,
  department: job.department?.name ?? null,
  position: job.position?.name ?? null,
  location: job.location,
  description: job.description,
  quantity: job.quantity,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  publishedAt: job.publishedAt,
});
