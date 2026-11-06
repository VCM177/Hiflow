import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Banknote, Building2, MapPin } from 'lucide-react';

import { ApplicationForm } from '@/features/careers/application-form';
import { formatSalaryRange } from '@/features/careers/format-salary';
import {
  jobPostingJsonLd,
  serializeJsonLd,
} from '@/features/careers/job-posting-json-ld';
import { jobPath, parseJobId } from '@/features/careers/job-url';
import { jobHtmlToText, sanitizeJobHtml } from '@/lib/sanitize-job-html';
import { formatDate } from '@/lib/format';
import { absoluteUrl } from '@/server/site-url';
import { visitorForwardedFor } from '@/server/forwarded-for';
import { fetchPublicJob } from '@/server/public-jobs';

async function loadJob(slugId: string) {
  const id = parseJobId(slugId);
  if (!id) notFound();
  const job = await fetchPublicJob(id, await visitorForwardedFor());
  if (!job) notFound();
  return job;
}

export async function generateMetadata({
  params,
}: PageProps<'/careers/[slugId]'>): Promise<Metadata> {
  const { slugId } = await params;
  const id = parseJobId(slugId);
  const job = id ? await fetchPublicJob(id, await visitorForwardedFor()) : null;
  if (!job) return { title: 'Tin không còn nhận hồ sơ · Hiflow' };
  return {
    title: `${job.title} · Hiflow`,
    description: jobHtmlToText(job.description).slice(0, 160) || undefined,
    alternates: { canonical: jobPath(job) },
  };
}

export default async function JobPage({
  params,
}: PageProps<'/careers/[slugId]'>) {
  const { slugId } = await params;
  const job = await loadJob(slugId);
  const canonical = jobPath(job);
  // A wrong or outdated slug (the title changed) goes to the one address of the job.
  if (canonical !== `/careers/${slugId}`) permanentRedirect(canonical);

  const description = sanitizeJobHtml(job.description);

  return (
    <article className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            jobPostingJsonLd(job, absoluteUrl(canonical)),
          ),
        }}
      />
      <header>
        <h1 className="text-xl font-semibold text-hf-text-heading">
          {job.title}
        </h1>
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
              <MapPin
                aria-hidden="true"
                className="size-4 text-hf-text-muted"
              />
              {job.location}
            </li>
          )}
          <li className="flex items-center gap-1">
            <Banknote
              aria-hidden="true"
              className="size-4 text-hf-text-muted"
            />
            {formatSalaryRange(job.salaryMin, job.salaryMax)}
          </li>
        </ul>
        {job.publishedAt && (
          <p className="mt-2 text-xs text-hf-text-muted">
            Đăng ngày {formatDate(job.publishedAt)} · Cần tuyển {job.quantity}{' '}
            người
          </p>
        )}
      </header>

      {description && (
        <section
          aria-label="Mô tả công việc"
          className="job-description text-sm text-hf-text-body"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      )}

      <section
        aria-labelledby="apply-heading"
        className="rounded-hf-container border border-hf-border bg-hf-bg-card p-4 shadow-hf-card"
      >
        <h2
          id="apply-heading"
          className="mb-4 text-base font-semibold text-hf-text-heading"
        >
          Ứng tuyển vị trí này
        </h2>
        <ApplicationForm jobId={job.id} thanksPath={`${canonical}/thanks`} />
      </section>
    </article>
  );
}
