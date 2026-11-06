'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { USER_ROLE_LABEL, type UserRole } from '@hiflow/shared-types';

import { DetailField } from '@/components/shared/detail-field';
import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

import { fetchAuditEvent, type AuditEventFull } from './audit-api';
import { ORIGIN_LABEL, ROW_OP_LABEL } from './constants';
import { describeChanges } from './row-changes';

function RowChange({
  change,
}: {
  change: AuditEventFull['rowChanges'][number];
}) {
  const lines = describeChanges(change);
  return (
    <li className="rounded-hf-container border border-hf-border p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge
          variant={
            change.op === 'D'
              ? 'destructive'
              : change.op === 'I'
                ? 'success'
                : 'primary'
          }
        >
          {ROW_OP_LABEL[change.op]}
        </Badge>
        <span className="font-medium text-hf-text-heading">
          {change.tableName}
        </span>
        <span className="text-xs break-all text-hf-text-muted">
          {change.rowId}
        </span>
      </p>
      {lines.length > 0 && (
        <dl className="mt-2 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 text-sm">
          {lines.map((line) => (
            <React.Fragment key={line.column}>
              <dt className="font-mono text-xs break-all text-hf-text-muted">
                {line.column}
              </dt>
              <dd className="break-words text-hf-text-body">
                {line.before !== undefined ? (
                  <>
                    <span className="text-hf-text-muted">{line.before}</span>
                    <span aria-label="đổi thành"> → </span>
                    <span>{line.after}</span>
                  </>
                ) : (
                  line.after
                )}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </li>
  );
}

/** One event with the row changes the database saw in the same transaction. Everything is shown as text. */
export function AuditDetail({ id }: { id: string }) {
  const query = useQuery({
    queryKey: queryKeys.detail('audit-event', id),
    queryFn: ({ signal }) => fetchAuditEvent(id, signal),
  });

  if (query.isPending) return <Skeleton className="h-64 w-full max-w-4xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const event = query.data;
  const data =
    Object.keys(event.data).length > 0
      ? JSON.stringify(event.data, null, 2)
      : null;

  return (
    <>
      <PageHeader
        title={event.label}
        description={formatDateTime(event.occurredAt)}
      />
      <div className="flex max-w-4xl flex-col gap-6">
        <SectionCard title="Sự kiện">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Người thực hiện (lúc đó)">
              {event.actor.name ?? 'Khách'}
              {event.actor.role &&
                ` · ${USER_ROLE_LABEL[event.actor.role as UserRole] ?? event.actor.role}`}
            </DetailField>
            <DetailField label="Đối tượng">
              {event.entityType}
              {event.entityId && (
                <span className="block text-xs text-hf-text-muted">
                  {event.entityId}
                </span>
              )}
            </DetailField>
            <DetailField label="Nguồn">
              {ORIGIN_LABEL[event.origin as keyof typeof ORIGIN_LABEL] ??
                event.origin}
            </DetailField>
            <DetailField label="Địa chỉ IP">{event.ip}</DetailField>
            <DetailField label="Trình duyệt" className="sm:col-span-2">
              {event.userAgent}
            </DetailField>
            <DetailField label="Mã giao dịch">{event.txId}</DetailField>
            <DetailField label="Mã yêu cầu">{event.requestId}</DetailField>
          </dl>
        </SectionCard>

        <SectionCard title="Dữ liệu của sự kiện">
          {data ? (
            <pre className="max-h-96 overflow-auto rounded-hf-control bg-hf-bg-surface p-3 text-xs break-words whitespace-pre-wrap text-hf-text-body">
              {data}
            </pre>
          ) : (
            <p className="text-sm text-hf-text-muted">
              Sự kiện không có dữ liệu kèm theo.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Thay đổi trong cơ sở dữ liệu"
          description="Các dòng đổi trong cùng một giao dịch. Mật khẩu luôn hiện là [REDACTED]."
        >
          {event.rowChanges.length === 0 ? (
            <p className="text-sm text-hf-text-muted">
              Không có thay đổi dòng nào.
            </p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Thay đổi dòng">
              {event.rowChanges.map((change) => (
                <RowChange key={change.id} change={change} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
