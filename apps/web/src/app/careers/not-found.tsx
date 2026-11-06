import Link from 'next/link';

import { StatusPage } from '@/components/layout/status-page';
import { buttonVariants } from '@/components/ui/button';
import { JobCard } from '@/features/careers/job-card';
import { visitorForwardedFor } from '@/server/forwarded-for';
import { fetchPublicJobs, type PublicJob } from '@/server/public-jobs';

// A draft, a closed job and an id that never existed all land here, so the page cannot
// be used to find out which jobs exist.
export default async function CareersNotFound() {
  let jobs: PublicJob[] = [];
  try {
    jobs = (await fetchPublicJobs({ limit: 5 }, await visitorForwardedFor()))
      .items;
  } catch {
    // The list is a courtesy; the message above it stands without it.
  }

  return (
    <>
      <StatusPage
        title="Tin này không còn nhận hồ sơ"
        description="Tin có thể đã đóng hoặc địa chỉ không đúng."
        actions={
          <Link
            href="/careers"
            className={buttonVariants({ variant: 'primary' })}
          >
            Xem tất cả vị trí
          </Link>
        }
      />
      {jobs.length > 0 && (
        <section aria-labelledby="open-jobs" className="flex flex-col gap-3">
          <h2
            id="open-jobs"
            className="text-base font-semibold text-hf-text-heading"
          >
            Các vị trí đang tuyển
          </h2>
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
