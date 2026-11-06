import { Skeleton } from '@/components/ui/skeleton';

// Shown while a careers page is read from the API; the shape matches a list of job cards so
// nothing jumps when the real content arrives.
export default function CareersLoading() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Đang tải</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
