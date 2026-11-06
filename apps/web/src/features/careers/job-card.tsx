import Link from 'next/link';
import { Banknote, Building2, MapPin } from 'lucide-react';

import { formatDate } from '@/lib/format';
import type { PublicJob } from '@/server/public-jobs';

import { formatSalaryRange } from './format-salary';
import { jobPath } from './job-url';

export function JobCard({ job }: { job: PublicJob }) {
  return (
    <li className="rounded-hf-container border border-hf-border bg-hf-bg-card p-4 shadow-hf-card">
      <h2 className="text-base font-semibold text-hf-text-heading">
        <Link
          href={jobPath(job)}
          className="hover:text-hf-primary hover:underline"
        >
          {job.title}
        </Link>
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-hf-text-body">
        {job.department && (
          <li className="flex items-center gap-1">
            <Building2
              aria-hidden="true"
              className="size-4 text-hf-text-muted"
            />
            {job.department}
          </li>
        )}
        {job.location && (
          <li className="flex items-center gap-1">
            <MapPin aria-hidden="true" className="size-4 text-hf-text-muted" />
            {job.location}
          </li>
        )}
        <li className="flex items-center gap-1">
          <Banknote aria-hidden="true" className="size-4 text-hf-text-muted" />
          {formatSalaryRange(job.salaryMin, job.salaryMax)}
        </li>
      </ul>
      {job.publishedAt && (
        <p className="mt-2 text-xs text-hf-text-muted">
          Đăng ngày {formatDate(job.publishedAt)}
        </p>
      )}
    </li>
  );
}
