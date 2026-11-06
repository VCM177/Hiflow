'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplicationStatus, PERMISSIONS } from '@hiflow/shared-types';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { DetailField } from '@/components/shared/detail-field';
import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { NotesSection } from '@/components/shared/notes-section';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  applicationCvUrl,
  changeApplicationAssignee,
  fetchApplication,
  setApplicationNote,
} from './application-api';
import {
  AssigneeDialog,
  NO_ASSIGNEE,
  type AssigneeValues,
} from './assignee-dialog';
import { APPLICATION_STATUS_MAP, isInProgress } from './constants';
import { InterviewsTab } from './interviews-tab';
import { OfferTab } from './offer-tab';
import { ProgressTab } from './progress-tab';

export function ApplicationDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [assigneeKey, setAssigneeKey] = React.useState<number | null>(null);
  const [assigneeOpen, setAssigneeOpen] = React.useState(false);
  const query = useQuery({
    queryKey: queryKeys.detail('application', id),
    queryFn: ({ signal }) => fetchApplication(id, signal),
  });

  if (query.isPending) return <Skeleton className="h-64 w-full max-w-4xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const application = query.data;
  const finished = !isInProgress(application.status);
  // The offer tab opens at the Offer step, or once there is an offer to read. HR cannot read offers.
  const showOffer =
    can(PERMISSIONS.offer.view) &&
    (application.status === ApplicationStatus.OFFER ||
      application.offer !== null);

  async function changeAssignee(values: AssigneeValues) {
    await changeApplicationAssignee(
      id,
      values.assigneeId === NO_ASSIGNEE ? null : values.assigneeId,
    );
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('application'),
    });
    toast.success('Đã đổi người phụ trách');
  }

  // A department manager reads the contact details but has no candidate page to open.
  const candidateName = application.candidate?.fullName ?? '—';
  const candidateTitle =
    application.candidate && can(PERMISSIONS.candidate.listView) ? (
      <Link
        href={`/candidates/${application.candidate.id}`}
        className="text-hf-primary hover:underline"
      >
        {candidateName}
      </Link>
    ) : (
      candidateName
    );

  return (
    <>
      <PageHeader
        title={application.candidate?.fullName ?? 'Hồ sơ ứng tuyển'}
        description={application.job?.title}
        actions={
          <>
            {application.hasCv && (
              <Link
                href={applicationCvUrl(id)}
                prefetch={false}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'secondary' })}
              >
                <Download aria-hidden="true" />
                Tải CV
              </Link>
            )}
            {!finished && (
              <PermissionGate
                permission={PERMISSIONS.application.assigneeUpdate}
              >
                <Button
                  onClick={() => {
                    setAssigneeKey((key) => (key ?? 0) + 1);
                    setAssigneeOpen(true);
                  }}
                >
                  Đổi người phụ trách
                </Button>
              </PermissionGate>
            )}
          </>
        }
      />
      <div className="flex max-w-4xl flex-col gap-6">
        <SectionCard
          title="Thông tin"
          actions={
            <StatusBadge
              status={application.status}
              map={APPLICATION_STATUS_MAP}
            />
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Ứng viên">{candidateTitle}</DetailField>
            <DetailField label="Email">
              {application.candidate?.email}
            </DetailField>
            <DetailField label="Số điện thoại">
              {application.candidateDetail?.phone}
            </DetailField>
            <DetailField label="Tin tuyển dụng">
              {application.job?.title}
            </DetailField>
            <DetailField label="Ngày nộp">
              {formatDate(application.appliedAt)}
            </DetailField>
            <DetailField label="Người phụ trách">
              {application.assignee?.name ?? 'Chưa phân công'}
            </DetailField>
          </dl>
        </SectionCard>

        <Tabs defaultValue="progress">
          <TabsList aria-label="Nội dung hồ sơ">
            <TabsTrigger value="progress">Tiến trình</TabsTrigger>
            <TabsTrigger value="interviews">Phỏng vấn</TabsTrigger>
            {showOffer && <TabsTrigger value="offer">Offer</TabsTrigger>}
            <TabsTrigger value="notes">Ghi chú</TabsTrigger>
          </TabsList>
          <TabsContent value="progress">
            <ProgressTab application={application} />
          </TabsContent>
          <TabsContent value="interviews">
            <InterviewsTab application={application} />
          </TabsContent>
          {showOffer && (
            <TabsContent value="offer">
              <OfferTab application={application} />
            </TabsContent>
          )}
          <TabsContent value="notes">
            <NotesSection
              title="Ghi chú"
              value={application.note}
              canEdit={can(PERMISSIONS.application.noteCreate)}
              maxLength={2000}
              onSave={async (value) => {
                await setApplicationNote(id, value ?? '');
                await queryClient.invalidateQueries({
                  queryKey: queryKeys.entity('application'),
                });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {assigneeKey !== null && (
        <AssigneeDialog
          key={assigneeKey}
          current={application.assignee?.id ?? null}
          open={assigneeOpen}
          onOpenChange={setAssigneeOpen}
          onSubmit={changeAssignee}
        />
      )}
    </>
  );
}
