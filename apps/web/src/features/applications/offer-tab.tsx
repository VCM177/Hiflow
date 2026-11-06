'use client';

import * as React from 'react';
import { OfferStatus, PERMISSIONS } from '@hiflow/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { DetailField } from '@/components/shared/detail-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionGate } from '@/components/shared/permission-gate';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

import {
  createOffer,
  respondToOffer,
  updateOffer,
  type ApplicationFull,
} from './application-api';
import { OFFER_STATUS_MAP } from './constants';
import { OfferDialog } from './offer-dialog';
import { isOfferExpired, toOfferBody, type OfferValues } from './offer-schema';

type Answer = 'accept' | 'decline';

/**
 * The offer: made while the application is at Đề nghị, edited while it waits for an answer,
 * and answered for the candidate. Accepting hires them; declining ends the application. An
 * offer past its deadline can only be declined.
 */
export function OfferTab({ application }: { application: ApplicationFull }) {
  const queryClient = useQueryClient();
  const offer = application.offer;
  const [dialogKey, setDialogKey] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const [answerOpen, setAnswerOpen] = React.useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.entity('application'),
    });
  }

  async function save(values: OfferValues) {
    if (offer) {
      await updateOffer(application.id, toOfferBody(values, 'edit'));
    } else {
      await createOffer(application.id, toOfferBody(values, 'create'));
    }
    await refresh();
    toast.success(offer ? 'Đã lưu đề nghị' : 'Đã tạo đề nghị');
  }

  function openDialog() {
    setDialogKey((key) => (key ?? 0) + 1);
    setDialogOpen(true);
  }
  function ask(next: Answer) {
    setAnswer(next);
    setAnswerOpen(true);
  }

  const pending = offer?.status === OfferStatus.PENDING;
  const expired = offer ? isOfferExpired(offer.expiresAt) : false;

  return (
    <SectionCard
      title="Đề nghị tuyển dụng"
      actions={
        !offer ? (
          <PermissionGate permission={PERMISSIONS.offer.create}>
            <Button variant="primary" onClick={openDialog}>
              Tạo đề nghị
            </Button>
          </PermissionGate>
        ) : pending ? (
          <PermissionGate permission={PERMISSIONS.offer.update}>
            <Button onClick={openDialog}>Sửa</Button>
          </PermissionGate>
        ) : undefined
      }
    >
      {!offer ? (
        <p className="text-sm text-hf-text-muted">
          Chưa có đề nghị cho hồ sơ này.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Trạng thái">
              <StatusBadge status={offer.status} map={OFFER_STATUS_MAP} />
            </DetailField>
            <DetailField label="Lương hằng tháng">
              {formatCurrency(offer.salary)}
            </DetailField>
            <DetailField label="Ngày nhận việc">
              {formatDate(offer.startDate)}
            </DetailField>
            <DetailField label="Hạn phản hồi">
              {offer.expiresAt ? formatDate(offer.expiresAt) : null}
            </DetailField>
            {offer.note && (
              <DetailField label="Ghi chú" className="sm:col-span-2">
                <span className="whitespace-pre-wrap">{offer.note}</span>
              </DetailField>
            )}
          </dl>
          {pending && (
            <PermissionGate permission={PERMISSIONS.offer.responseRecord}>
              <div className="flex flex-wrap gap-2">
                {!expired && (
                  <Button variant="primary" onClick={() => ask('accept')}>
                    Ứng viên chấp nhận
                  </Button>
                )}
                <Button onClick={() => ask('decline')}>Ứng viên từ chối</Button>
              </div>
            </PermissionGate>
          )}
          {pending && expired && (
            <p className="text-sm text-hf-text-muted">
              Đề nghị đã quá hạn nên chỉ ghi nhận được việc từ chối.
            </p>
          )}
        </div>
      )}

      {dialogKey !== null && (
        <OfferDialog
          key={dialogKey}
          offer={offer}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={save}
        />
      )}
      <ConfirmDialog
        open={answerOpen && answer === 'accept'}
        onOpenChange={setAnswerOpen}
        title="Ứng viên chấp nhận đề nghị"
        description="Hồ sơ chuyển sang Nhận việc. Không thể hoàn tác."
        confirmLabel="Ghi nhận chấp nhận"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await respondToOffer(application.id, true);
          await refresh();
          toast.success('Đã ghi nhận ứng viên nhận việc');
        }}
      />
      <ConfirmDialog
        open={answerOpen && answer === 'decline'}
        onOpenChange={setAnswerOpen}
        title="Ứng viên từ chối đề nghị"
        description="Hồ sơ chuyển sang Ứng viên rút và kết thúc. Không thể hoàn tác."
        confirmLabel="Ghi nhận từ chối"
        onReload={() => void refresh()}
        onConfirm={async () => {
          await respondToOffer(application.id, false);
          await refresh();
          toast.success('Đã ghi nhận ứng viên từ chối đề nghị');
        }}
      />
    </SectionCard>
  );
}
