'use client';

import * as React from 'react';
import { APPLICATION_STATUS_LABEL, PERMISSIONS } from '@hiflow/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import {
  VerticalTimeline,
  type TimelineItem,
} from '@/components/shared/vertical-timeline';
import { Button } from '@/components/ui/button';
import { describeApiError } from '@/lib/api/describe-error';
import { queryKeys } from '@/lib/query/keys';

import {
  changeApplicationStatus,
  type ApplicationFull,
} from './application-api';
import { statusActionsFor, type StatusAction } from './constants';

function historyItems(application: ApplicationFull): TimelineItem[] {
  return [...application.history]
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .map((item) => ({
      id: item.id,
      title: item.fromStatus
        ? `Chuyển từ ${APPLICATION_STATUS_LABEL[item.fromStatus]} sang ${APPLICATION_STATUS_LABEL[item.toStatus]}`
        : `Nộp hồ sơ (${APPLICATION_STATUS_LABEL[item.toStatus]})`,
      at: item.changedAt,
      actor: item.changedBy?.name ?? null,
      note: item.note,
    }));
}

/**
 * The status buttons and the history. The buttons are the transitions of the status map,
 * with Nhận việc left out (it only follows an accepted offer); Đề nghị is locked, with the
 * reason, until a round passed and none is waiting.
 */
export function ProgressTab({ application }: { application: ApplicationFull }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<StatusAction | null>(null);
  const [open, setOpen] = React.useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('application'),
    });
  }

  async function advance(action: StatusAction) {
    setBusy(action.to);
    try {
      await changeApplicationStatus(application.id, action.to);
      await refresh();
      toast.success(`Đã chuyển sang ${APPLICATION_STATUS_LABEL[action.to]}`);
    } catch (error) {
      toast.error(describeApiError(error).message);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const actions = statusActionsFor(application);

  return (
    <div className="flex flex-col gap-6">
      {actions.length > 0 && (
        <PermissionGate permission={PERMISSIONS.application.statusUpdate}>
          <SectionCard title="Chuyển bậc">
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <PermissionGate
                  key={action.to}
                  permission={PERMISSIONS.application.statusUpdate}
                  disabledReason={action.disabledReason}
                >
                  <Button
                    variant={
                      action.kind === 'advance' ? 'primary' : 'secondary'
                    }
                    disabled={busy !== null}
                    onClick={() => {
                      if (action.kind === 'advance') {
                        void advance(action);
                      } else {
                        setConfirm(action);
                        setOpen(true);
                      }
                    }}
                  >
                    {action.label}
                  </Button>
                </PermissionGate>
              ))}
            </div>
          </SectionCard>
        </PermissionGate>
      )}
      <SectionCard title="Lịch sử">
        <VerticalTimeline
          items={historyItems(application)}
          label="Lịch sử hồ sơ"
        />
      </SectionCard>

      <ConfirmDialog
        open={open && confirm?.kind === 'reject'}
        onOpenChange={setOpen}
        title="Từ chối hồ sơ"
        description="Hồ sơ chuyển sang Từ chối, các lịch phỏng vấn và đề nghị còn mở bị hủy. Không thể hoàn tác."
        confirmLabel="Từ chối hồ sơ"
        reason={{ label: 'Lý do từ chối', placeholder: 'Nêu lý do' }}
        onReload={() => void refresh()}
        onConfirm={async (reason) => {
          await changeApplicationStatus(application.id, confirm!.to, reason);
          await refresh();
          toast.success('Đã từ chối hồ sơ');
        }}
      />
      <ConfirmDialog
        open={open && confirm?.kind === 'withdraw'}
        onOpenChange={setOpen}
        title="Ứng viên rút hồ sơ"
        description="Ghi nhận ứng viên không tiếp tục. Các lịch phỏng vấn và đề nghị còn mở bị hủy. Không thể hoàn tác."
        confirmLabel="Ghi nhận ứng viên rút"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await changeApplicationStatus(application.id, confirm!.to);
          await refresh();
          toast.success('Đã ghi nhận ứng viên rút hồ sơ');
        }}
      />
    </div>
  );
}
