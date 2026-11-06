'use client';

import * as React from 'react';
import {
  ApplicationStatus,
  InterviewResult,
  PERMISSIONS,
} from '@hiflow/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { scheduleInterview } from '@/features/interviews/interview-api';
import { ScheduleDialog } from '@/features/interviews/schedule-dialog';
import {
  toScheduleBody,
  type ScheduleValues,
} from '@/features/interviews/schedule-schema';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

import type { ApplicationFull } from './application-api';
import { INTERVIEW_RESULT_MAP } from './constants';

/** The rounds so far, and the button to book the next one when the application is ready for it. */
export function InterviewsTab({
  application,
}: {
  application: ApplicationFull;
}) {
  const queryClient = useQueryClient();
  const [dialogKey, setDialogKey] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);

  const rounds = [...application.interviews].sort((a, b) => a.round - b.round);
  const hasPending = rounds.some(
    (item) => item.result === InterviewResult.PENDING,
  );
  const nextRound =
    rounds.reduce((max, item) => Math.max(max, item.round), 0) + 1;
  const canBook =
    application.status === ApplicationStatus.INTERVIEW && !hasPending;

  async function schedule(values: ScheduleValues) {
    await scheduleInterview({
      applicationId: application.id,
      ...toScheduleBody(values),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('application'),
    });
    toast.success('Đã đặt lịch phỏng vấn');
  }

  return (
    <SectionCard
      title="Các vòng phỏng vấn"
      actions={
        canBook ? (
          <PermissionGate permission={PERMISSIONS.interview.create}>
            <Button
              variant="primary"
              onClick={() => {
                setDialogKey((key) => (key ?? 0) + 1);
                setOpen(true);
              }}
            >
              Đặt lịch
            </Button>
          </PermissionGate>
        ) : undefined
      }
    >
      {rounds.length === 0 ? (
        <p className="text-sm text-hf-text-muted">Chưa có lịch phỏng vấn.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-hf-border">
          {rounds.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-hf-text-heading">
                  Vòng {item.round} · {formatDateTime(item.scheduledAt)}
                </p>
                <StatusBadge status={item.result} map={INTERVIEW_RESULT_MAP} />
              </div>
              <p className="text-sm text-hf-text-body">
                Người phỏng vấn: {item.interviewer?.name ?? '—'}
              </p>
              {item.feedback && (
                <p className="text-sm whitespace-pre-wrap text-hf-text-body">
                  {item.feedback}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {application.status === ApplicationStatus.INTERVIEW && hasPending && (
        <p className="mt-3 text-sm text-hf-text-muted">
          Còn lịch chờ kết quả: ghi kết quả trước khi đặt vòng tiếp theo.
        </p>
      )}
      {dialogKey !== null && (
        <ScheduleDialog
          key={dialogKey}
          open={open}
          onOpenChange={setOpen}
          onSubmit={schedule}
          nextRound={nextRound}
        />
      )}
    </SectionCard>
  );
}
