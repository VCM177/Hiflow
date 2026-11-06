import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_TRANSITIONS,
  ApplicationStatus,
  INTERVIEW_RESULT_LABEL,
  InterviewResult,
  OFFER_STATUS_LABEL,
  OfferStatus,
} from '@hiflow/shared-types';

import type { StatusMap } from '@/components/shared/status-badge';

// Colours follow the design guide: in-progress steps primary, screening waiting,
// hired success, rejected destructive, withdrawn neutral.
export const APPLICATION_STATUS_MAP: StatusMap<ApplicationStatus> = {
  [ApplicationStatus.NEW]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.NEW],
    variant: 'primary',
  },
  [ApplicationStatus.SCREENING]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.SCREENING],
    variant: 'warning',
  },
  [ApplicationStatus.INTERVIEW]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.INTERVIEW],
    variant: 'primary',
  },
  [ApplicationStatus.OFFER]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.OFFER],
    variant: 'primary',
  },
  [ApplicationStatus.HIRED]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.HIRED],
    variant: 'success',
  },
  [ApplicationStatus.REJECTED]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.REJECTED],
    variant: 'destructive',
  },
  [ApplicationStatus.WITHDRAWN]: {
    label: APPLICATION_STATUS_LABEL[ApplicationStatus.WITHDRAWN],
    variant: 'neutral',
  },
};

export function isApplicationStatus(
  value: unknown,
): value is ApplicationStatus {
  return (
    typeof value === 'string' &&
    (Object.values(ApplicationStatus) as string[]).includes(value)
  );
}

export const APPLICATION_STATUS_OPTIONS = Object.values(ApplicationStatus).map(
  (status) => ({ value: status, label: APPLICATION_STATUS_LABEL[status] }),
);

/** The columns the API lets the application list sort by (`ListApplicationsQueryDto.sortBy`). */
export const APPLICATION_SORT_KEYS = [
  'appliedAt',
  'status',
  'candidateName',
  'jobTitle',
] as const;

export interface StatusAction {
  to: ApplicationStatus;
  /** The button text, an action and not the status name. */
  label: string;
  /** Why the step is locked right now, or undefined when it is open. */
  disabledReason?: string;
  /** Rejecting asks for a reason; withdrawing asks for a confirmation. */
  kind: 'advance' | 'reject' | 'withdraw';
}

const ADVANCE_LABEL: Partial<Record<ApplicationStatus, string>> = {
  [ApplicationStatus.SCREENING]: 'Chuyển sang Sàng lọc',
  [ApplicationStatus.INTERVIEW]: 'Chuyển sang Phỏng vấn',
  [ApplicationStatus.OFFER]: 'Chuyển sang Đề nghị',
};

/**
 * The status buttons of an application. They are exactly `APPLICATION_TRANSITIONS[status]`,
 * except Nhận việc: that step happens only when the candidate accepts an offer. The server
 * checks the interview rules again; here a locked step says why before anyone clicks.
 */
export function statusActionsFor(application: {
  status: ApplicationStatus;
  interviews: readonly { result: InterviewResult }[];
}): StatusAction[] {
  const actions: StatusAction[] = [];
  for (const to of APPLICATION_TRANSITIONS[application.status]) {
    if (to === ApplicationStatus.HIRED) continue;
    if (to === ApplicationStatus.REJECTED) {
      actions.push({ to, label: 'Từ chối hồ sơ', kind: 'reject' });
    } else if (to === ApplicationStatus.WITHDRAWN) {
      actions.push({ to, label: 'Ứng viên rút', kind: 'withdraw' });
    } else {
      actions.push({
        to,
        label: ADVANCE_LABEL[to] ?? APPLICATION_STATUS_LABEL[to],
        kind: 'advance',
        disabledReason:
          to === ApplicationStatus.OFFER
            ? offerBlockedReason(application.interviews)
            : undefined,
      });
    }
  }
  // Advancing first, then reject and withdraw.
  return actions.sort(
    (a, b) => Number(a.kind !== 'advance') - Number(b.kind !== 'advance'),
  );
}

function offerBlockedReason(
  interviews: readonly { result: InterviewResult }[],
): string | undefined {
  if (interviews.some((item) => item.result === InterviewResult.PENDING)) {
    return 'Còn lịch phỏng vấn chưa có kết quả.';
  }
  if (!interviews.some((item) => item.result === InterviewResult.PASSED)) {
    return 'Cần ít nhất một vòng phỏng vấn đạt trước khi đề nghị.';
  }
  return undefined;
}

/** True while the application is still being worked on (no final outcome yet). */
export function isInProgress(status: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[status].length > 0;
}

export const INTERVIEW_RESULT_MAP: StatusMap<InterviewResult> = {
  [InterviewResult.PENDING]: {
    label: INTERVIEW_RESULT_LABEL[InterviewResult.PENDING],
    variant: 'warning',
  },
  [InterviewResult.PASSED]: {
    label: INTERVIEW_RESULT_LABEL[InterviewResult.PASSED],
    variant: 'success',
  },
  [InterviewResult.FAILED]: {
    label: INTERVIEW_RESULT_LABEL[InterviewResult.FAILED],
    variant: 'destructive',
  },
  [InterviewResult.CANCELLED]: {
    label: INTERVIEW_RESULT_LABEL[InterviewResult.CANCELLED],
    variant: 'neutral',
  },
};

export const OFFER_STATUS_MAP: StatusMap<OfferStatus> = {
  [OfferStatus.PENDING]: {
    label: OFFER_STATUS_LABEL[OfferStatus.PENDING],
    variant: 'warning',
  },
  [OfferStatus.ACCEPTED]: {
    label: OFFER_STATUS_LABEL[OfferStatus.ACCEPTED],
    variant: 'success',
  },
  [OfferStatus.DECLINED]: {
    label: OFFER_STATUS_LABEL[OfferStatus.DECLINED],
    variant: 'destructive',
  },
};
