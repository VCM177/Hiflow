import type { MetadataRoute } from 'next';

import { jobPath } from '@/features/careers/job-url';
import { absoluteUrl } from '@/server/site-url';
import { fetchPublicJobs, type PublicJob } from '@/server/public-jobs';

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/** Every open job, newest first, a hundred at a time. A failure leaves the list shorter, never the sitemap broken. */
async function openJobs(): Promise<PublicJob[]> {
  const jobs: PublicJob[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await fetchPublicJobs({ page, limit: PAGE_SIZE }, null);
      jobs.push(...result.items);
      if (page >= result.meta.totalPages) break;
    }
  } catch {
    // The board is unreachable right now; the next crawl will see the jobs.
  }
  return jobs;
}

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await openJobs();
  return [
    { url: absoluteUrl('/careers') },
    ...jobs.map((job) => ({
      url: absoluteUrl(jobPath(job)),
      lastModified: job.publishedAt ?? undefined,
    })),
  ];
}
