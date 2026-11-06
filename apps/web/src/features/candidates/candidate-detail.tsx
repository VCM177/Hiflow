'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SOURCE_LABEL } from '@hiflow/shared-types';
import { Info } from 'lucide-react';
import { toast } from 'sonner';

import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { NotesSection } from '@/components/shared/notes-section';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { APPLICATION_STATUS_MAP } from '@/features/applications/constants';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  anonymizeCandidate,
  fetchCandidate,
  setCandidateNote,
  updateCandidate,
} from './candidate-api';
import { CandidateCvSection } from './candidate-cv-section';
import { CandidateFormDialog } from './candidate-form-dialog';
import { toCandidateBody, type CandidateValues } from './candidate-schema';
import { CANDIDATE_PERMISSION } from './constants';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-hf-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-hf-text-body">{children ?? '—'}</dd>
    </div>
  );
}

export function CandidateDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [editKey, setEditKey] = React.useState<number | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [anonymizing, setAnonymizing] = React.useState(false);
  const query = useQuery({
    queryKey: queryKeys.detail('candidate', id),
    queryFn: ({ signal }) => fetchCandidate(id, signal),
  });

  if (query.isPending) return <Skeleton className="h-64 w-full max-w-3xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const candidate = query.data;
  const editable = candidate.anonymizedAt === null;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('candidate'),
    });
  }

  async function save(values: CandidateValues) {
    await updateCandidate(id, toCandidateBody(values, 'edit'));
    await refresh();
    toast.success('Đã lưu thay đổi');
  }

  return (
    <>
      <PageHeader
        title={candidate.fullName}
        description={candidate.email}
        actions={
          editable ? (
            <>
              <PermissionGate permission={CANDIDATE_PERMISSION.update}>
                <Button
                  onClick={() => {
                    setEditKey((key) => (key ?? 0) + 1);
                    setEditOpen(true);
                  }}
                >
                  Sửa
                </Button>
              </PermissionGate>
              <PermissionGate permission={CANDIDATE_PERMISSION.anonymize}>
                <Button onClick={() => setAnonymizing(true)}>Ẩn danh</Button>
              </PermissionGate>
            </>
          ) : undefined
        }
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {!editable && (
          <div
            role="status"
            className="flex gap-3 rounded-hf-container border border-hf-border bg-hf-bg-surface p-4 text-sm text-hf-text-body"
          >
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              Ứng viên này đã được ẩn danh
              {candidate.anonymizedAt &&
                ` ngày ${formatDate(candidate.anonymizedAt)}`}
              . Dữ liệu cá nhân và CV đã bị xóa; hồ sơ chỉ còn để tính số liệu
              và không chỉnh sửa được.
            </p>
          </div>
        )}
        <SectionCard title="Thông tin">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên">{candidate.fullName}</Field>
            <Field label="Email">{candidate.email}</Field>
            <Field label="Số điện thoại">{candidate.phone}</Field>
            <Field label="Ngày sinh">
              {candidate.dob ? formatDate(candidate.dob) : null}
            </Field>
            <Field label="Nguồn">
              {SOURCE_LABEL[candidate.source] ?? candidate.source}
            </Field>
            <Field label="Ngày tạo">{formatDate(candidate.createdAt)}</Field>
          </dl>
        </SectionCard>
        <CandidateCvSection candidate={candidate} onChanged={refresh} />
        <NotesSection
          title="Ghi chú"
          value={candidate.note}
          canEdit={editable && can(CANDIDATE_PERMISSION.note)}
          maxLength={2000}
          onSave={async (value) => {
            await setCandidateNote(id, value ?? '');
            await refresh();
          }}
        />
        <SectionCard title="Lịch sử ứng tuyển">
          {candidate.applications.length === 0 ? (
            <p className="text-sm text-hf-text-muted">Chưa nộp hồ sơ nào.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {candidate.applications.map((application) => (
                <li
                  key={application.id}
                  className="flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <Link
                    href={`/applications/${application.id}`}
                    className="font-medium text-hf-primary hover:underline"
                  >
                    {application.jobTitle}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="text-hf-text-muted">
                      {formatDate(application.appliedAt)}
                    </span>
                    <StatusBadge
                      status={application.status}
                      map={APPLICATION_STATUS_MAP}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {editKey !== null && (
        <CandidateFormDialog
          key={editKey}
          candidate={candidate}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={save}
        />
      )}
      <ConfirmDialog
        open={anonymizing}
        onOpenChange={setAnonymizing}
        title="Ẩn danh ứng viên"
        description="Họ tên, email, số điện thoại, ngày sinh, ghi chú và CV của ứng viên sẽ bị xóa vĩnh viễn; chỉ giữ lại hồ sơ để tính số liệu. Thao tác này không thể hoàn tác và chặn mọi chỉnh sửa sau đó."
        confirmLabel="Ẩn danh ứng viên"
        onConfirm={async () => {
          await anonymizeCandidate(id);
          await refresh();
          toast.success('Đã ẩn danh ứng viên');
        }}
      />
    </>
  );
}
