import type { PublicJob } from '@/server/public-jobs';

import { jobHtmlToText, sanitizeJobHtml } from '@/lib/sanitize-job-html';

export const ORGANIZATION_NAME = 'Hiflow';

/** schema.org JobPosting for search engines. Returned as an object; the page serialises it. */
export function jobPostingJsonLd(job: PublicJob, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: sanitizeJobHtml(job.description) || jobHtmlToText(job.title),
    datePosted: job.publishedAt ?? undefined,
    url,
    hiringOrganization: { '@type': 'Organization', name: ORGANIZATION_NAME },
    jobLocation: job.location
      ? {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: job.location },
        }
      : undefined,
    baseSalary:
      job.salaryMin !== null || job.salaryMax !== null
        ? {
            '@type': 'MonetaryAmount',
            currency: 'VND',
            value: {
              '@type': 'QuantitativeValue',
              minValue: job.salaryMin ?? undefined,
              maxValue: job.salaryMax ?? undefined,
              unitText: 'MONTH',
            },
          }
        : undefined,
  };
}

/** JSON for a <script> tag: `<` is escaped so no value can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
