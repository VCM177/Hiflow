'use client';

import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS, RequisitionStatus } from '@hiflow/shared-types';

import { ApiErrorView, ErrorView } from '@/components/layout/api-error-view';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import { fetchRequisition } from './requisition-api';
import { RequisitionForm } from './requisition-form';

export function NewRequisitionPage() {
  const { can } = useSession();
  if (!can(PERMISSIONS.requisition.create))
    return <ErrorView kind="forbidden" />;
  return <RequisitionForm requisition={null} />;
}

/** `/requisitions/[id]/edit`: loads the record, then shows the form. Only draft and rejected can be edited. */
export function EditRequisitionPage({ id }: { id: string }) {
  const { can } = useSession();
  const allowed = can(PERMISSIONS.requisition.update);
  const query = useQuery({
    queryKey: queryKeys.detail('requisition', id),
    queryFn: ({ signal }) => fetchRequisition(id, signal),
    enabled: allowed,
  });

  if (!allowed) return <ErrorView kind="forbidden" />;
  if (query.isPending) return <Skeleton className="h-96 w-full max-w-3xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const { status } = query.data;
  if (
    status !== RequisitionStatus.DRAFT &&
    status !== RequisitionStatus.REJECTED
  ) {
    return <ErrorView kind="forbidden" />;
  }
  return <RequisitionForm requisition={query.data} />;
}
