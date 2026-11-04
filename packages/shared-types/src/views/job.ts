import type { JobStatus } from '../statuses';
import type { NamedRef } from './ref';

export interface JobView {
  id: string;
  requisition: { id: string; code: string } | null;
  title: string;
  position: NamedRef | null;
  department: NamedRef | null;
  quantity: number;
  salaryMin: number | null;
  salaryMax: number | null;
  location: string | null;
  description: string | null;
  status: JobStatus;
  publishedAt: Date | null;
  createdBy: NamedRef | null;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;
}
