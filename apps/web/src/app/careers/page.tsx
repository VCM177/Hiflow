import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JobCard } from '@/features/careers/job-card';
import { JOBS_PER_PAGE } from '@/features/careers/constants';
import { visitorForwardedFor } from '@/server/forwarded-for';
import { fetchPublicJobs } from '@/server/public-jobs';

export const metadata: Metadata = {
  title: 'Cơ hội nghề nghiệp · Hiflow',
  description: 'Các vị trí Hiflow đang tuyển dụng.',
};

const SORTS = {
  publishedAt: 'Mới đăng',
  title: 'Tên vị trí',
} as const;
type SortKey = keyof typeof SORTS;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function href(search: string, sortBy: SortKey, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (sortBy !== 'publishedAt') params.set('sortBy', sortBy);
  if (page > 1) params.set('page', String(page));
  const text = params.toString();
  return text ? `/careers?${text}` : '/careers';
}

export default async function CareersPage({
  searchParams,
}: PageProps<'/careers'>) {
  const raw = await searchParams;
  const search = first(raw.search).trim().slice(0, 100);
  const sortBy: SortKey =
    first(raw.sortBy) === 'title' ? 'title' : 'publishedAt';
  const page = Math.max(1, Math.floor(Number(first(raw.page))) || 1);

  const result = await fetchPublicJobs(
    {
      search,
      sortBy,
      sortDir: sortBy === 'title' ? 'asc' : 'desc',
      page,
      limit: JOBS_PER_PAGE,
    },
    await visitorForwardedFor(),
  );
  const { items: jobs, meta } = result;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-hf-text-heading">
          Cơ hội nghề nghiệp
        </h1>
        <p className="mt-1 text-sm text-hf-text-muted">
          {meta.total} vị trí đang tuyển
        </p>
      </div>

      <form
        action="/careers"
        method="get"
        role="search"
        className="flex flex-wrap gap-2"
      >
        <Input
          name="search"
          type="search"
          defaultValue={search}
          maxLength={100}
          placeholder="Tìm theo tên vị trí"
          aria-label="Tìm vị trí"
          className="min-w-0 flex-1"
        />
        <select
          name="sortBy"
          defaultValue={sortBy}
          aria-label="Sắp xếp"
          className="h-9 rounded-hf-control border border-hf-border-control bg-hf-bg-card px-2 text-sm text-hf-text-body"
        >
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORTS[key]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={buttonVariants({ variant: 'primary' })}
        >
          Tìm
        </button>
      </form>

      {jobs.length === 0 ? (
        <EmptyState
          title={
            search
              ? 'Không có vị trí khớp từ khóa'
              : 'Hiện chưa có vị trí nào đang tuyển'
          }
          description={
            search
              ? 'Thử từ khóa khác hoặc xem tất cả vị trí.'
              : 'Vui lòng quay lại sau.'
          }
          action={
            search ? (
              <Link
                href="/careers"
                className={buttonVariants({ variant: 'secondary' })}
              >
                Xem tất cả vị trí
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}

      {meta.totalPages > 1 && (
        <nav
          aria-label="Phân trang"
          className="flex items-center justify-between text-sm"
        >
          {meta.page > 1 ? (
            <Link
              href={href(search, sortBy, meta.page - 1)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Trang trước
            </Link>
          ) : (
            <span />
          )}
          <span className="text-hf-text-muted">
            Trang {meta.page} / {meta.totalPages}
          </span>
          {meta.page < meta.totalPages ? (
            <Link
              href={href(search, sortBy, meta.page + 1)}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Trang sau
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
