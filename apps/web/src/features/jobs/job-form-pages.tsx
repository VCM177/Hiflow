'use client';

import { useQuery } from '@tanstack/react-query';
import {
  JobStatus,
  PERMISSIONS,
  RequisitionStatus,
} from '@hiflow/shared-types';

import { ApiErrorView, ErrorView } from '@/components/layout/api-error-view';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRequisitions } from '@/features/requisitions/requisition-api';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { fetchJob } from './job-api';
import { JobForm, type RequisitionChoice } from './job-form';

/** `/jobs/new`: loads the approved requisitions, then shows the form. */
export function NewJobPage({
  requisitionId,
}: {
  requisitionId: string | undefined;
}) {
  const { can } = useSession();
  const allowed = can(PERMISSIONS.job.create);
  const query = useQuery({
    queryKey: queryKeys.options('requisition', {
      status: RequisitionStatus.APPROVED,
    }),
    queryFn: ({ signal }) =>
      fetchRequisitions(
        {
          status: RequisitionStatus.APPROVED,
          limit: 100,
          sortBy: 'createdAt',
          sortDir: 'desc',
        },
        signal,
      ),
    enabled: allowed,
  });

  if (!allowed) return <ErrorView kind="forbidden" />;
  if (query.isPending) return <Skeleton className="h-96 w-full max-w-3xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }

  const choices: RequisitionChoice[] = query.data.items.map((item) => ({
    id: item.id,
    title: item.title,
    quantity: item.quantity,
    label: `${item.code} · ${item.title}`,
  }));
  return (
    <JobForm
      job={null}
      requisitions={choices}
      preselected={choices.find((item) => item.id === requisitionId) ?? null}
    />
  );
}

/** `/jobs/[id]/edit`: loads the job, then shows the form. A closed job cannot be edited. */
export function EditJobPage({ id }: { id: string }) {
  const { can } = useSession();
  const allowed = can(PERMISSIONS.job.update);
  const query = useQuery({
    queryKey: queryKeys.detail('job', id),
    queryFn: ({ signal }) => fetchJob(id, signal),
    enabled: allowed,
  });

  if (!allowed) return <ErrorView kind="forbidden" />;
  if (query.isPending) return <Skeleton className="h-96 w-full max-w-3xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  if (query.data.status === JobStatus.CLOSED) {
    return <ErrorView kind="forbidden" />;
  }
  return <JobForm job={query.data} requisitions={[]} preselected={null} />;
}
