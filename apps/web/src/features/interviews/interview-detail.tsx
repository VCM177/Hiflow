'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { InterviewResult, PERMISSIONS, UserRole } from '@hiflow/shared-types';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { DetailField } from '@/components/shared/detail-field';
import { ApiErrorView } from '@/components/layout/api-error-view';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  applicationCvUrl,
  fetchApplication,
} from '@/features/applications/application-api';
import {
  INTERVIEW_RESULT_MAP,
  APPLICATION_STATUS_MAP,
} from '@/features/applications/constants';
import { JobDescription } from '@/features/jobs/job-description';
import { fetchJob } from '@/features/jobs/job-api';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';

import {
  cancelInterview,
  fetchInterview,
  recordInterviewResult,
  updateInterview,
  type Interview,
  type RecordableResult,
} from './interview-api';
import { ResultForm } from './result-form';
import { ScheduleDialog } from './schedule-dialog';
import { toVietnamIso, type ScheduleValues } from './schedule-schema';

function ResultSection({
  interview,
  canRecord,
  onRecord,
  onReload,
}: {
  interview: Interview;
  canRecord: boolean;
  onReload: () => void;
  onRecord: (body: {
    result: RecordableResult;
    feedback?: string;
  }) => Promise<void>;
}) {
  const pending = interview.result === InterviewResult.PENDING;
  if (pending && canRecord)
    return <ResultForm onSubmit={onRecord} onReload={onReload} />;
  return (
    <SectionCard title="Kết quả phỏng vấn">
      <div className="flex flex-col gap-3">
        <StatusBadge status={interview.result} map={INTERVIEW_RESULT_MAP} />
        {interview.feedback && (
          <p className="text-sm whitespace-pre-wrap text-hf-text-body">
            {interview.feedback}
          </p>
        )}
        {pending && (
          <p className="text-sm text-hf-text-muted">
            Chỉ người được xếp lịch mới ghi được kết quả.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function CvSection({ applicationId }: { applicationId: string }) {
  const query = useQuery({
    queryKey: queryKeys.detail('application', applicationId),
    queryFn: ({ signal }) => fetchApplication(applicationId, signal),
  });
  return (
    <SectionCard title="CV và thông tin liên hệ">
      {query.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : query.error ? (
        <p className="text-sm text-hf-destructive-text">
          Không tải được hồ sơ.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Ứng viên">
              {query.data.candidate?.fullName}
            </DetailField>
            <DetailField label="Email">
              {query.data.candidate?.email}
            </DetailField>
            <DetailField label="Số điện thoại">
              {query.data.candidateDetail?.phone}
            </DetailField>
          </dl>
          {query.data.hasCv ? (
            <div>
              {/* Opens in a new tab; never prefetched, a visit would count as a download. */}
              <Link
                href={applicationCvUrl(applicationId)}
                prefetch={false}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'secondary' })}
              >
                <Download aria-hidden="true" />
                Tải CV
              </Link>
            </div>
          ) : (
            <p className="text-sm text-hf-text-muted">Hồ sơ chưa có CV.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** The job. An interviewer cannot read the jobs list, so the description shows only to roles that can. */
function JobSection({ applicationId }: { applicationId: string }) {
  const { can } = useSession();
  const application = useQuery({
    queryKey: queryKeys.detail('application', applicationId),
    queryFn: ({ signal }) => fetchApplication(applicationId, signal),
  });
  const jobId = application.data?.job?.id;
  const allowed = can(PERMISSIONS.job.listView);
  const job = useQuery({
    queryKey: queryKeys.detail('job', jobId ?? ''),
    queryFn: ({ signal }) => fetchJob(jobId!, signal),
    enabled: allowed && Boolean(jobId),
  });

  return (
    <SectionCard title="Tin tuyển dụng">
      {application.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : application.error ? (
        <p className="text-sm text-hf-destructive-text">Không tải được tin.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-hf-text-heading">
            {application.data.job?.title ?? '—'}
          </p>
          <StatusBadge
            status={application.data.status}
            map={APPLICATION_STATUS_MAP}
          />
          {allowed && job.data ? (
            <JobDescription html={job.data.description} />
          ) : allowed && job.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            !allowed && (
              <p className="text-sm text-hf-text-muted">
                Mô tả công việc chỉ hiện với vai trò được xem tin tuyển dụng.
              </p>
            )
          )}
        </div>
      )}
    </SectionCard>
  );
}

export function InterviewDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { user, can } = useSession();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [editKey, setEditKey] = React.useState<number | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const query = useQuery({
    queryKey: queryKeys.detail('interview', id),
    queryFn: ({ signal }) => fetchInterview(id, signal),
  });

  if (query.isPending) return <Skeleton className="h-64 w-full max-w-4xl" />;
  if (query.error) {
    return (
      <ApiErrorView error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const interview = query.data;
  const applicationId = interview.application?.id;
  const pending = interview.result === InterviewResult.PENDING;
  // Everyone decides only their own interviews, except the Admin.
  const mine =
    user.role === UserRole.ADMIN || interview.interviewer?.id === user.id;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.entity('interview'),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.entity('application'),
      }),
    ]);
  }

  async function save(values: ScheduleValues) {
    await updateInterview(id, {
      interviewerId: values.interviewerId,
      scheduledAt: toVietnamIso(values.scheduledAt),
      ...(values.round === '' ? {} : { round: Number(values.round) }),
    });
    await refresh();
    toast.success('Đã lưu lịch phỏng vấn');
  }

  const result = (
    <ResultSection
      interview={interview}
      canRecord={mine && can(PERMISSIONS.interview.resultRecord)}
      onReload={() => void refresh()}
      onRecord={async (body) => {
        await recordInterviewResult(id, body);
        await refresh();
        toast.success('Đã ghi kết quả phỏng vấn');
      }}
    />
  );
  const cv = applicationId ? <CvSection applicationId={applicationId} /> : null;
  const job = applicationId ? (
    <JobSection applicationId={applicationId} />
  ) : null;

  return (
    <>
      <PageHeader
        title={`${interview.application?.candidate?.fullName ?? 'Phỏng vấn'} · Vòng ${interview.round}`}
        description={interview.application?.job?.title}
        actions={
          <>
            {interview.application && can(PERMISSIONS.application.listView) && (
              <Link
                href={`/applications/${interview.application.id}`}
                className={buttonVariants({ variant: 'secondary' })}
              >
                Mở hồ sơ
              </Link>
            )}
            {pending && (
              <>
                <PermissionGate permission={PERMISSIONS.interview.update}>
                  <Button
                    onClick={() => {
                      setEditKey((key) => (key ?? 0) + 1);
                      setEditOpen(true);
                    }}
                  >
                    Sửa lịch
                  </Button>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.interview.cancel}>
                  <Button onClick={() => setCancelling(true)}>Hủy lịch</Button>
                </PermissionGate>
              </>
            )}
          </>
        }
      />
      <div className="flex max-w-6xl flex-col gap-6">
        <SectionCard title="Lịch phỏng vấn">
          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Giờ phỏng vấn">
              {formatDateTime(interview.scheduledAt)}
            </DetailField>
            <DetailField label="Người phỏng vấn">
              {interview.interviewer?.name}
            </DetailField>
            <DetailField label="Kết quả">
              <StatusBadge
                status={interview.result}
                map={INTERVIEW_RESULT_MAP}
              />
            </DetailField>
          </dl>
        </SectionCard>

        {wide ? (
          <div className="grid grid-cols-2 items-start gap-6">
            {result}
            <div className="flex flex-col gap-6">
              {cv}
              {job}
            </div>
          </div>
        ) : (
          // Narrow screens: one thing at a time, the result first.
          <Tabs defaultValue="result">
            <TabsList aria-label="Nội dung buổi phỏng vấn">
              <TabsTrigger value="result">Kết quả</TabsTrigger>
              <TabsTrigger value="cv">CV</TabsTrigger>
              <TabsTrigger value="job">Tin</TabsTrigger>
            </TabsList>
            <TabsContent value="result">{result}</TabsContent>
            <TabsContent value="cv">{cv}</TabsContent>
            <TabsContent value="job">{job}</TabsContent>
          </Tabs>
        )}
      </div>

      {editKey !== null && (
        <ScheduleDialog
          key={editKey}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={save}
          nextRound={interview.round}
          interview={interview}
        />
      )}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Hủy lịch phỏng vấn"
        description="Lịch phỏng vấn sẽ chuyển sang Đã hủy. Có thể đặt lịch mới cho hồ sơ này sau đó."
        confirmLabel="Hủy lịch"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await cancelInterview(id);
          await refresh();
          toast.success('Đã hủy lịch phỏng vấn');
        }}
      />
    </>
  );
}
